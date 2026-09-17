/**
 * Reasonny Service Worker (PWA).
 *
 * Implements high-performance caching for static assets, fonts, and icons,
 * with network-first resilience for authenticated financial data, plus
 * native notification handling for autonomous PWA alerts.
 */

const CACHE_NAME = 'reasonny-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/apple-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Continue install even if optional offline assets fail in dev
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Do NOT cache API endpoints, auth proxy, or telemetry
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Cache-first for fonts, images, frames and icons
  if (
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/frames/')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      }),
    );
    return;
  }

  // Network-first with cache fallback for HTML navigation
  if (request.mode === 'navigate') {
    // In local development, never serve cached navigate to prevent stale HMR code
    const isLocalhost = Boolean(
      url.hostname === 'localhost' ||
      url.hostname === '[::1]' ||
      url.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
    );

    if (isLocalhost) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => cached || caches.match('/'));
      }),
    );
  }
});

/**
 * Native Notification Click Handler:
 * When a user taps an expense notification (e.g. "Gasto guardado, ¡categorízalo!"),
 * close the notification and focus the app or navigate to the target route.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const origin = self.location.origin;
      for (const client of clientList) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
