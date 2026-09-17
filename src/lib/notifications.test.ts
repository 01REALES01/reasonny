import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationPermission,
  notifyExpenseSaved,
  notifyIncomeSaved,
  requestNotificationPermission,
  sendAppNotification,
  sendWelcomeNotification,
} from './notifications';

describe('PWA Notifications System (lib/notifications.ts)', () => {
  const originalNotification = globalThis.Notification;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      value: originalNotification,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns unsupported when Notification API is absent', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getNotificationPermission()).toBe('unsupported');
  });

  it('returns current permission when Notification API exists', () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    expect(getNotificationPermission()).toBe('granted');
  });

  it('requests permission and returns the user decision', async () => {
    const requestPermissionMock = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: requestPermissionMock,
      },
      writable: true,
      configurable: true,
    });

    const result = await requestNotificationPermission();
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe('granted');
  });

  it('dispatches notification via ServiceWorkerRegistration when available', async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'granted',
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: showNotificationMock,
          }),
        },
      },
      writable: true,
      configurable: true,
    });

    const ok = await sendAppNotification({
      title: 'Test Notification',
      body: 'Testing body',
      url: '/dashboard',
    });

    expect(ok).toBe(true);
    expect(showNotificationMock).toHaveBeenCalledWith('Test Notification', {
      body: 'Testing body',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'reasonny-alert',
      data: { url: '/dashboard' },
    });
  });

  it('falls back to window Notification when service worker is absent', async () => {
    const NotificationMock = vi.fn();
    (NotificationMock as any).permission = 'granted';

    Object.defineProperty(globalThis, 'Notification', {
      value: NotificationMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const ok = await sendAppNotification({
      title: 'Fallback Alert',
      body: 'Testing window fallback',
    });

    expect(ok).toBe(true);
    expect(NotificationMock).toHaveBeenCalledWith('Fallback Alert', {
      body: 'Testing window fallback',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'reasonny-alert',
      data: { url: '/dashboard' },
    });
  });

  it('formats expense notification correctly for categorized expenses', async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ showNotification: showNotificationMock }),
        },
      },
      writable: true,
      configurable: true,
    });

    await notifyExpenseSaved({
      amountMinor: 4500000n, // $45.000 COP
      currency: 'COP',
      merchant: 'Éxito',
      categoryName: 'Supermercado',
      isUncategorized: false,
    });

    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('Gasto de'),
      expect.objectContaining({
        body: 'Supermercado · Éxito',
        data: { url: '/dashboard' },
      }),
    );
  });

  it('formats expense notification with prompt to categorize for uncategorized expenses', async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ showNotification: showNotificationMock }),
        },
      },
      writable: true,
      configurable: true,
    });

    await notifyExpenseSaved({
      amountMinor: 2000000n, // $20.000 COP
      currency: 'COP',
      merchant: 'Panadería',
      isUncategorized: true,
    });

    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('Gasto de'),
      expect.objectContaining({
        body: expect.stringContaining('¡Categorízalo'),
        data: { url: '/revisar' },
      }),
    );
  });

  it('dispatches welcome notification properly', async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ showNotification: showNotificationMock }),
        },
      },
      writable: true,
      configurable: true,
    });

    await sendWelcomeNotification();

    expect(showNotificationMock).toHaveBeenCalledWith('Reasonny', {
      body: '🔔 ¡Notificaciones activadas! Te avisaremos al instante con cada gasto guardado.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'reasonny-welcome',
      data: { url: '/dashboard' },
    });
  });

  it('dispatches income notification properly', async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ showNotification: showNotificationMock }),
        },
      },
      writable: true,
      configurable: true,
    });

    await notifyIncomeSaved({
      amountMinor: 350000000n, // $3.500.000 COP
      currency: 'COP',
      merchant: 'Salario Nómina',
    });

    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('Ingreso de'),
      expect.objectContaining({
        body: 'Salario Nómina',
        data: { url: '/dashboard' },
      }),
    );
  });
});
