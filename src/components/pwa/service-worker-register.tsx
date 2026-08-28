'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker in production environments.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service workers are progressive enhancements; failures do not block runtime.
      });
    }
  }, []);

  return null;
}
