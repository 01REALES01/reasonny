/**
 * Telemetry domain service (B9, principle P9).
 *
 * The clients - the PWA today, Telegram and a native app later - report raw
 * observations. Deciding what a metric means, what unit it is in and whether it
 * meets the P7 budget happens here, once, so two clients cannot disagree about
 * what "INP" is.
 *
 * Note what is NOT here: the `after()` scheduling that keeps recording off the
 * response path. That is a Next.js concern and lives in the app layer, because
 * a Telegram handler recording the same metric has no `after()` and must not be
 * forced to pretend it does.
 */
import {
  getDailyUsage,
  getMetricPercentiles,
  recordTelemetryEvent,
} from '@/core/repositories/telemetry.repository';
import {
  computeDailyUsageRate,
  fromScaledValue,
  hasPerformanceBudget,
  meetsPerformanceBudget,
  PERFORMANCE_BUDGET,
  toScaledValue,
  type TelemetryMetric,
  type TelemetryRating,
} from '@/core/telemetry';
import type { UserId } from '@/core/types';

export interface RecordMetricInput {
  readonly metric: TelemetryMetric;
  /** In the metric's natural unit: milliseconds, or a ratio for CLS. */
  readonly value: number;
  readonly rating?: TelemetryRating | null;
  readonly route?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

/**
 * Records one observation, converting to the stored fixed-point scale.
 */
export async function recordMetric(
  userId: UserId,
  input: RecordMetricInput,
): Promise<void> {
  await recordTelemetryEvent(userId, {
    metric: input.metric,
    valueScaled: toScaledValue(input.value),
    rating: input.rating ?? null,
    route: input.route ?? null,
    metadata: input.metadata ?? null,
  });
}

/**
 * Records a batch.
 *
 * WHY NOT Promise.allSettled WITH PER-SAMPLE REJECTION REPORTING
 * -------------------------------------------------------------
 * It used to be that, on the reasoning that one NaN should not discard the
 * other four samples in a beacon. But the only caller is the telemetry route,
 * and by the time a sample reaches here it has passed
 * `z.number().finite().min(0).max(86_400_000)` and a `z.enum` over the metric
 * names - which is every input toScaledValue rejects. The machinery guarded a
 * case its own caller had already made impossible, and the shape it returned
 * meant the route had to branch on failures that could not occur.
 *
 * What is left that CAN fail is the database, and that fails for the whole
 * batch or not at all. Promise.all says exactly that, and the route already
 * catches and logs it.
 */
export async function recordMetrics(
  userId: UserId,
  inputs: readonly RecordMetricInput[],
): Promise<void> {
  await Promise.all(inputs.map((input) => recordMetric(userId, input)));
}

export interface MetricSummary {
  readonly metric: TelemetryMetric;
  /** P6: never render any percentile below without this next to it. */
  readonly n: number;
  readonly unit: 'ms' | 'ratio';
  readonly p50: number | null;
  readonly p75: number | null;
  readonly p95: number | null;
  readonly min: number | null;
  readonly max: number | null;
  /** Present only for metrics P7 puts a number on. */
  readonly budget: { target: number; failing: number; meets: boolean | null } | null;
}

export interface Phase1Baselines {
  readonly generatedAt: Date;
  readonly timezone: string;
  readonly manualEntryDuration: MetricSummary;
  readonly dashboardQueryDuration: MetricSummary;
  readonly webVitals: readonly MetricSummary[];
  readonly dailyUsage: {
    readonly daysWithEntry: number;
    readonly daysElapsed: number;
    readonly rate: number;
  };
}

async function summarise(
  userId: UserId,
  metric: TelemetryMetric,
  since?: Date,
): Promise<MetricSummary> {
  const percentiles = await getMetricPercentiles(userId, metric, since);

  const toUnit = (scaled: bigint | null): number | null =>
    scaled === null ? null : fromScaledValue(scaled);

  const p75 = toUnit(percentiles.p75Scaled);
  const budgeted = hasPerformanceBudget(metric);

  return {
    metric,
    n: percentiles.n,
    unit: budgeted && PERFORMANCE_BUDGET[metric].unit === 'ratio' ? 'ratio' : 'ms',
    p50: toUnit(percentiles.p50Scaled),
    p75,
    p95: toUnit(percentiles.p95Scaled),
    min: toUnit(percentiles.minScaled),
    max: toUnit(percentiles.maxScaled),
    budget: budgeted
      ? {
          target: PERFORMANCE_BUDGET[metric].budget,
          failing: PERFORMANCE_BUDGET[metric].failing,
          // null, not false, when nothing has been measured. "We have no
          // reading" and "we are failing the budget" are different states and
          // P6 does not allow reporting the first as the second.
          meets: p75 === null ? null : meetsPerformanceBudget(metric, p75),
        }
      : null,
  };
}

/**
 * Everything IMPLEMENTATION_PLAN.md section 11.9 requires METRICS.md to contain,
 * in one call, with n attached to every figure.
 */
export async function getPhase1Baselines(
  userId: UserId,
  timezone: string,
  since?: Date,
): Promise<Phase1Baselines> {
  const [manualEntry, dashboardQuery, lcp, inp, cls, usage] = await Promise.all([
    summarise(userId, 'manual_entry_duration', since),
    summarise(userId, 'dashboard_query_duration', since),
    summarise(userId, 'LCP', since),
    summarise(userId, 'INP', since),
    summarise(userId, 'CLS', since),
    getDailyUsage(userId, timezone, since),
  ]);

  return {
    generatedAt: new Date(),
    timezone,
    manualEntryDuration: manualEntry,
    dashboardQueryDuration: dashboardQuery,
    webVitals: [lcp, inp, cls],
    dailyUsage: {
      daysWithEntry: usage.daysWithEntry,
      daysElapsed: usage.daysElapsed,
      rate: computeDailyUsageRate(usage.daysWithEntry, usage.daysElapsed),
    },
  };
}
