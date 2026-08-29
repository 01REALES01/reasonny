/**
 * Client-side telemetry (B9) - the browser half of the measurement.
 *
 * Everything here runs in the user's browser and is therefore untrusted input
 * by the time it reaches the server. This module's job is narrow: observe,
 * buffer, and hand the samples over cheaply. It holds no opinion about what a
 * metric means (core/telemetry.ts) and no access to the database.
 *
 * P7 applies to this file as much as to any component: instrumentation that
 * costs INP to measure INP is worse than no instrumentation, because it
 * corrupts the very number it reports.
 *
 * WHY web-vitals IS NOT IMPORTED AT MODULE SCOPE
 * ---------------------------------------------
 * The entry form imports `startTiming` from this file. A static
 * `import ... from 'web-vitals'` here would therefore pull the whole library
 * into the /nuevo bundle, where nothing uses it - on the screen whose entire
 * purpose is to be fast. The library is imported inside initWebVitals()
 * instead, so it lands in a chunk that only loads when something actually
 * subscribes to the vitals.
 */
import type { TelemetryMetric, TelemetryRating } from '@/core/telemetry';

const ENDPOINT = '/api/v1/telemetry';

interface TelemetrySample {
  metric: TelemetryMetric;
  value: number;
  rating?: TelemetryRating;
  route?: string;
}

const queue: TelemetrySample[] = [];
let initialised = false;

/**
 * The route the vitals subscription started on.
 *
 * Captured once, at subscription time, and NOT read again when a metric
 * reports. LCP, CLS and INP settle at page-hide, which after a soft navigation
 * is a different pathname from the one that was actually measured - attributing
 * the sample to wherever the user happened to end up would blame the last
 * screen for the first screen's numbers.
 */
let vitalsRoute: string | null = null;

/**
 * Hands the buffer to the browser and clears it.
 *
 * WHY sendBeacon AND NOT fetch
 * ----------------------------
 * The interesting samples are produced at the worst possible moment: INP is
 * only final once the user stops interacting, which in practice means as the
 * tab is being hidden or closed. A `fetch` issued then is cancelled by the
 * browser along with the rest of the page's work. `sendBeacon` is queued by the
 * browser itself and survives the page, which is the entire reason it exists.
 *
 * The queue is emptied with splice BEFORE the send, not after: if the beacon is
 * refused, retrying it on the next flush would send the same samples twice and
 * quietly double n. An n that is wrong upward is worse than a lost sample,
 * because it is invisible.
 */
function flush(): void {
  if (queue.length === 0) return;

  const samples = queue.splice(0, queue.length);
  const body = JSON.stringify({ samples });

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }

  // Older Safari. `keepalive` is the same promise as sendBeacon's, with a
  // smaller payload ceiling that a handful of numbers never approaches.
  void fetch(ENDPOINT, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {
    // A dropped measurement is not worth an error in the user's console on a
    // screen where they are trying to record an expense.
  });
}

function enqueue(sample: TelemetrySample): void {
  queue.push(sample);
}

/**
 * Subscribes to the Core Web Vitals and arranges for them to be sent.
 *
 * Idempotent, because React runs effects twice in development and double
 * subscription would double-report every metric - which would not be visible
 * in the numbers, only in a suspiciously round doubling of n.
 *
 * Note there is no `reportAllChanges`: the default reports CLS and INP once,
 * at their final value. Reporting every change would fill the table with
 * intermediate readings that are not what P7 is defined on.
 */
export async function initWebVitals(): Promise<void> {
  if (typeof window === 'undefined' || initialised) return;
  // Set before the await so two concurrent callers cannot both subscribe, and
  // cleared again if the import fails - otherwise one flaky chunk load would
  // disable measurement for the rest of the page's life with no way back.
  initialised = true;

  vitalsRoute = window.location.pathname;

  let vitals: typeof import('web-vitals');
  try {
    vitals = await import('web-vitals');
  } catch {
    // Nothing to tell the user: they came here to record an expense, and the
    // instrument failing to load is not their problem. Swallowed rather than
    // rethrown so the caller's `void initWebVitals()` cannot become an
    // unhandled rejection.
    initialised = false;
    return;
  }

  const { onCLS, onFCP, onINP, onLCP, onTTFB } = vitals;

  const handle = (metric: {
    name: string;
    value: number;
    rating: TelemetryRating;
  }): void => {
    // Spread rather than `route: vitalsRoute ?? undefined`: under
    // exactOptionalPropertyTypes an explicit undefined is not the same as an
    // absent key, and the schema distinguishes them too.
    enqueue({
      metric: metric.name as TelemetryMetric,
      value: metric.value,
      rating: metric.rating,
      ...(vitalsRoute !== null ? { route: vitalsRoute } : {}),
    });
  };

  onLCP(handle);
  onINP(handle);
  onCLS(handle);
  onFCP(handle);
  onTTFB(handle);

  // Both events, deliberately. `visibilitychange` is the reliable one on
  // desktop and Android; iOS Safari has historically not fired it when the
  // user swipes the app away, and `pagehide` is what covers that. Firing both
  // is harmless: the second flush finds an empty queue.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * Starts a stopwatch and returns the function that stops it.
 *
 * This is the baseline of the whole project: time from opening the entry form
 * to a successful save. Phase 2 (OCR) and phase 4 (automatic capture) are both
 * measured against the number this produces, and it can only be captured while
 * entry is still fully manual - which is now.
 *
 * Uses performance.now() rather than Date.now() because it is monotonic: a
 * clock adjustment or an NTP sync mid-form would make a wall-clock difference
 * negative or wildly large, and that sample would then be rejected outright by
 * core/telemetry.ts.
 */
export function startTiming(): () => number {
  const startedAt = performance.now();
  return () => performance.now() - startedAt;
}

/**
 * Reports how long a manual entry took, and sends it straight away.
 *
 * Unlike the web vitals, this one does not wait for the page to be hidden. The
 * user has just saved an expense and will very often stay on the app; holding
 * the sample until unload risks losing it to a crash or a hard refresh, and
 * unlike LCP it cannot be re-observed on the next page load.
 *
 * Reads the pathname at call time, which is correct here and not for the
 * vitals: this sample is produced by an action the user just took, on the
 * screen they are looking at.
 */
export function reportManualEntryDuration(durationMs: number, route?: string): void {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  enqueue({
    metric: 'manual_entry_duration',
    value: durationMs,
    route: route ?? window.location.pathname,
  });
  flush();
}

/** Exposed for tests, which need a way to observe the buffer without a network. */
export function __getQueueForTesting(): readonly TelemetrySample[] {
  return queue;
}

/** Exposed for tests: resets module state between cases. */
export function __resetForTesting(): void {
  queue.length = 0;
  initialised = false;
  vitalsRoute = null;
}
