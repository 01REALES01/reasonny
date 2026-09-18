'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker for offline resilience and autonomous
 * push/local notifications.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Check for updates when coming back to the foreground
        reg.update().catch(() => {});
      })
      .catch((error) => {
        // Progressive enhancement: failures do not block the app
        console.warn('[PWA] Service worker registration bypassed:', error);
      });
  }, []);

  return null;
}
