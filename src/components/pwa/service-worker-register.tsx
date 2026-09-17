'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker in production environments.
 *
 * WHY DEVELOPMENT ACTIVELY UNREGISTERS
 * ------------------------------------
 * Skipping the registration in development is not enough. A service worker
 * survives the build that installed it: one `next build && next start` on
 * localhost leaves a worker controlling that origin forever, and it keeps
 * answering from its cache while `next dev` serves brand-new code on the same
 * port. The symptom is a screen that will not change no matter how many times
 * the source is saved - and nothing in the dev server's output says so.
 * Tearing it down here makes development always show what is on disk.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service workers are progressive enhancements; failures do not block runtime.
      });
      return;
    }

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .then(() => caches?.keys())
      .then((keys) => Promise.all((keys ?? []).map((key) => caches.delete(key))))
      .catch(() => {
        // Nothing to clean up, or the browser denied it. Either way, harmless.
      });
  }, []);

  return null;
}
