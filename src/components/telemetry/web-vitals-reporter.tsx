'use client';

import { useEffect } from 'react';

import { initWebVitals } from '@/lib/telemetry';

/**
 * Subscribes the page to Core Web Vitals reporting (B9).
 *
 * Renders nothing and mounts in the root layout, so every route is measured -
 * including the ones added later, which is the point: an instrument you have to
 * remember to attach is one you will forget on the page that regresses.
 *
 * The deferral that keeps web-vitals out of the first paint lives inside
 * initWebVitals(), which imports the library dynamically. Doing it there rather
 * than here means the entry form gets the same benefit from importing
 * startTiming() out of the same module.
 */
export function WebVitalsReporter(): null {
  useEffect(() => {
    void initWebVitals();
  }, []);

  return null;
}
