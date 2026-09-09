/**
 * RealMoney Service Worker (PWA — B8).
 *
 * Implements high-performance caching for static assets, fonts, and icons,
 * with network-first resilience for authenticated financial data.
 */

const CACHE_NAME = 'reasonny-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/frames/mobile/frame_001.jpg',
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

  // Do NOT cache API endpoints or auth proxy
  if (url.pathname.startsWith('/api/')) {
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

  // Network-first with cache fallback for HTML pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => cached || caches.match('/'));
      }),
    );
  }
});
