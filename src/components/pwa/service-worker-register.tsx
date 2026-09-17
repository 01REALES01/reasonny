'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker for offline resilience and autonomous
 * push/local notifications.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
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
