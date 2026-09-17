import { formatMoney, money } from '@/core/money';

export interface AppNotificationOptions {
  readonly title: string;
  readonly body?: string;
  readonly tag?: string;
  readonly url?: string;
  readonly icon?: string;
  readonly badge?: string;
}

export type PermissionStatus = NotificationPermission | 'unsupported';

/**
 * Checks if the Web Notifications API is supported and what the current permission is.
 */
export function getNotificationPermission(): PermissionStatus {
  if (typeof globalThis === 'undefined' || typeof globalThis.Notification === 'undefined') {
    return 'unsupported';
  }
  return (globalThis.Notification as any).permission;
}

/**
 * Requests native notification permission from the user's browser or device.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (typeof globalThis === 'undefined' || typeof globalThis.Notification === 'undefined') {
    return 'unsupported';
  }

  try {
    const result = await (globalThis.Notification as any).requestPermission();
    return result;
  } catch (error) {
    console.warn('[notifications] Failed to request permission:', error);
    return (globalThis.Notification as any).permission;
  }
}

/**
 * Autonomous PWA notification dispatcher:
 * Works seamlessly in desktop browsers, Android Chrome, and standalone iOS PWA (iOS 16.4+).
 * Prioritizes ServiceWorkerRegistration.showNotification for PWA compliance,
 * with graceful fallback to the window Notification constructor.
 */
export async function sendAppNotification({
  title,
  body,
  tag = 'reasonny-alert',
  url = '/dashboard',
  icon = '/icons/icon-192.png',
  badge = '/icons/icon-192.png',
}: AppNotificationOptions): Promise<boolean> {
  if (typeof globalThis === 'undefined' || typeof globalThis.Notification === 'undefined') {
    return false;
  }

  const NotificationAPI = globalThis.Notification as any;
  if (NotificationAPI.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    icon,
    badge,
    tag,
    data: { url },
    ...(body !== undefined ? { body } : {}),
  };

  // 1. Try Service Worker Registration (Standard for PWAs)
  if ('navigator' in globalThis && 'serviceWorker' in globalThis.navigator) {
    try {
      const registration = await globalThis.navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    } catch {
      // Fall through to window Notification API
    }
  }

  // 2. Fallback to Window Notification constructor
  try {
    const notification = new NotificationAPI(title, notificationOptions);

    notification.onclick = (event: any) => {
      event?.preventDefault?.();
      if (typeof window !== 'undefined') {
        window.focus?.();
        if (url && window.location.pathname !== url) {
          window.location.href = url;
        }
      }
    };

    return true;
  } catch {
    return false;
  }
}

/**
 * Dispatches an immediate welcome notification upon enabling permissions.
 */
export async function sendWelcomeNotification(): Promise<boolean> {
  return sendAppNotification({
    title: 'Reasonny',
    body: '🔔 ¡Notificaciones activadas! Te avisaremos al instante con cada gasto guardado.',
    tag: 'reasonny-welcome',
    url: '/dashboard',
  });
}

export interface NotifyExpenseParams {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly merchant: string;
  readonly categoryName?: string | null;
  readonly isUncategorized?: boolean;
}

/**
 * Generates an autonomous notification when an expense is saved.
 * Highlights whether the expense needs categorization or has been tagged.
 */
export async function notifyExpenseSaved({
  amountMinor,
  currency,
  merchant,
  categoryName,
  isUncategorized = false,
}: NotifyExpenseParams): Promise<boolean> {
  const formatted = formatMoney(money(amountMinor, currency), 'es-CO');

  if (isUncategorized) {
    return sendAppNotification({
      title: `Gasto de ${formatted} guardado`,
      body: `¡Categorízalo para mantener tus finanzas al día! · ${merchant}`,
      tag: `expense-${Date.now()}`,
      url: '/revisar',
    });
  }

  const details = categoryName ? `${categoryName} · ${merchant}` : merchant;

  return sendAppNotification({
    title: `Gasto de ${formatted} guardado`,
    body: details,
    tag: `expense-${Date.now()}`,
    url: '/dashboard',
  });
}

export interface NotifyIncomeParams {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly merchant: string;
}

/**
 * Generates an autonomous notification when an income is saved.
 */
export async function notifyIncomeSaved({
  amountMinor,
  currency,
  merchant,
}: NotifyIncomeParams): Promise<boolean> {
  const formatted = formatMoney(money(amountMinor, currency), 'es-CO');

  return sendAppNotification({
    title: `Ingreso de ${formatted} guardado`,
    body: merchant,
    tag: `income-${Date.now()}`,
    url: '/dashboard',
  });
}
