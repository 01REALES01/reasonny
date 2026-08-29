/**
 * Telemetry primitives (B9) - pure, no database, no browser.
 *
 * This module exists for the same reason core/money.ts does: the conversion
 * between "what the browser reported" and "what the column stores" is the kind
 * of arithmetic that is trivial to get wrong once and then wrong forever in
 * every number the project ever publishes. It is testable without a database
 * or a DOM, so it is tested exhaustively.
 *
 * P6 governs everything downstream of here: no metric is reported without n,
 * method and baseline. This file is the "method" half of that sentence.
 */

/**
 * Fixed scale for every stored telemetry value, mirroring the scale-100 rule
 * money uses. 1000 was chosen against the two shapes of value that arrive:
 *
 *  - durations in milliseconds, where sub-millisecond precision is noise but
 *    losing the integer millisecond would be a real loss of resolution;
 *  - CLS, a unitless ratio whose P7 budget is 0.1 and whose failure line is
 *    0.25. Three decimals distinguishes 0.098 from 0.101, which is the only
 *    distinction that changes a decision.
 */
export const TELEMETRY_SCALE = 1000n;

/**
 * The complete set of metrics phase 1 records. Kept as a const tuple so the
 * union type, the Zod enum at the API edge and the CHECK constraint in the
 * schema all derive from one list: adding a metric here and forgetting the
 * migration is exactly how a metric ends up silently rejected by Postgres in
 * production. telemetry.test.ts asserts this tuple against that constraint.
 */
export const TELEMETRY_METRICS = [
  'LCP',
  'INP',
  'CLS',
  'FCP',
  'TTFB',
  'manual_entry_duration',
  'dashboard_query_duration',
] as const;

export type TelemetryMetric = (typeof TELEMETRY_METRICS)[number];

export const TELEMETRY_RATINGS = ['good', 'needs-improvement', 'poor'] as const;

export type TelemetryRating = (typeof TELEMETRY_RATINGS)[number];

/**
 * Browser value -> stored integer.
 *
 * Rounds rather than truncates: truncation biases every duration downward, and
 * a baseline that flatters itself is worse than no baseline, because the
 * comparison against it in phase 2 inherits the bias with the opposite sign.
 *
 * Rejects NaN, Infinity and negatives instead of coercing them. A negative
 * duration is a broken clock, and silently storing 0 for it would put a
 * fabricated fast sample into the p50.
 */
export function toScaledValue(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Telemetry value must be finite, received ${value}.`);
  }
  if (value < 0) {
    throw new RangeError(`Telemetry value must not be negative, received ${value}.`);
  }
  return BigInt(Math.round(value * Number(TELEMETRY_SCALE)));
}

/**
 * Stored integer -> value in the metric's own unit (ms, or a CLS ratio).
 *
 * Returns a JS number, and that is correct here in a way it would not be for
 * money: this is the presentation edge of a statistic, not an amount someone
 * is owed. A tenth of a millisecond of float error in a reported p95 changes
 * nothing; the same error in a balance is a defect.
 */
export function fromScaledValue(scaled: bigint): number {
  return Number(scaled) / Number(TELEMETRY_SCALE);
}

/**
 * The P7 performance budget, as numbers rather than prose.
 *
 * `budget` is the target the project holds itself to; `failing` is the point
 * CLAUDE.md calls a failure. The band between them is "needs improvement" -
 * not passing, but not a regression to stop the line for.
 */
export const PERFORMANCE_BUDGET = {
  LCP: { budget: 2500, failing: 4000, unit: 'ms' },
  INP: { budget: 200, failing: 500, unit: 'ms' },
  CLS: { budget: 0.1, failing: 0.25, unit: 'ratio' },
} as const satisfies Record<
  string,
  { budget: number; failing: number; unit: 'ms' | 'ratio' }
>;

export type BudgetedMetric = keyof typeof PERFORMANCE_BUDGET;

export function hasPerformanceBudget(
  metric: TelemetryMetric,
): metric is BudgetedMetric {
  return metric in PERFORMANCE_BUDGET;
}

/**
 * Whether a p75 reading meets the P7 budget.
 *
 * Takes p75 specifically, and the parameter is named so, because P7 is defined
 * on the 75th percentile of real users. Handing this function a p50 would
 * produce a true-looking answer to a question nobody asked.
 */
export function meetsPerformanceBudget(
  metric: BudgetedMetric,
  p75Value: number,
): boolean {
  return p75Value <= PERFORMANCE_BUDGET[metric].budget;
}

/**
 * Days with at least one entry / days elapsed - the retention baseline of
 * IMPLEMENTATION_PLAN.md B9.
 *
 * Lives here, away from SQL, because the definition is a judgement call and
 * deserves to be visible: `daysElapsed` counts calendar days since the first
 * entry, inclusive, so a user who signed up today and recorded one expense is
 * at 1/1 rather than 1/0. Zero elapsed days returns 0 instead of dividing.
 */
export function computeDailyUsageRate(
  daysWithEntry: number,
  daysElapsed: number,
): number {
  if (daysElapsed <= 0) return 0;
  return daysWithEntry / daysElapsed;
}
