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
import { isLearnableMerchantKey } from '@/core/categorization';
import { getRuleStats } from '@/core/repositories/categorization-rule.repository';
import { getFailureStats, type FailureStats } from '@/core/repositories/ingestion-failure.repository';
import { getPromptStats, type PromptStats } from '@/core/repositories/notification-prompt.repository';
import {
  getDailyUsage,
  getMetricPercentiles,
  recordTelemetryEvent,
} from '@/core/repositories/telemetry.repository';
import { getCaptureBreakdown } from '@/core/repositories/transaction.repository';
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
 * Records a batch, and names anything the database refused.
 *
 * These are N independent INSERTs, not one transaction, so a per-row failure -
 * a CHECK violation after the metric vocabulary and the migration drift apart,
 * or one oversized `route` - commits the rest and rejects only its own. That
 * is why this uses allSettled rather than Promise.all: Promise.all would
 * report a batch that was mostly written as a total failure, and would say
 * nothing about which sample was at fault.
 *
 * Returns the failing metric names rather than a count. A beacon is
 * fire-and-forget from a page that is being unloaded; the metric name is the
 * only detail that makes such a failure diagnosable afterwards, and it is
 * cheaper to carry than to reconstruct from a stack trace.
 *
 * (An earlier version of this returned per-sample rejections with reasons, to
 * stop one NaN discarding a beacon's other four samples. That specific case
 * cannot happen: the route validates with z.number().finite().min(0)
 * .max(86_400_000) and a z.enum before anything reaches toScaledValue. What
 * remains here is the database's own per-row refusal, which is real.)
 */
export async function recordMetrics(
  userId: UserId,
  inputs: readonly RecordMetricInput[],
): Promise<{ failed: string[] }> {
  const results = await Promise.allSettled(
    inputs.map((input) => recordMetric(userId, input)),
  );

  const failed = results.flatMap((result, index) =>
    result.status === 'rejected' ? [inputs[index]?.metric ?? 'unknown'] : [],
  );

  return { failed };
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

// ── Phase 4: capture and categorisation ─────────────────────────────────────

/**
 * The numbers METRICS.md's phase-4 entries are made of.
 *
 * Assembled here rather than in the script because two of them are judgements,
 * not counts, and a judgement in a script is a judgement nobody reviews:
 *
 * - Which uncategorised rows a rule could EVER have handled. "Transferencia
 *   enviada" is a placeholder the bank never named, so no amount of learning
 *   will ever categorise it - counting those against the engine would report a
 *   failure that is not the engine's.
 * - Which failures belong to a capture channel's denominator. A message that
 *   never parsed is a lost expense for that channel; one rejected for a bad
 *   token never had a channel.
 */
export interface Phase4Snapshot {
  readonly total: number;
  readonly bySource: ReadonlyArray<{ readonly source: string; readonly n: number; readonly pct: number }>;
  readonly byLevel: ReadonlyArray<{ readonly level: string; readonly n: number; readonly pct: number }>;
  readonly autoCategorizedRate: number;
  readonly uncategorized: number;
  /** Uncategorised rows a rule could plausibly learn from, one day. */
  readonly uncategorizedLearnable: number;
  /** Uncategorised rows no engine can ever help with. Only the person knows. */
  readonly uncategorizedUnnameable: number;
  readonly rules: { readonly rules: number; readonly hits: number };
  readonly prompts: readonly PromptStats[];
  readonly failures: readonly FailureStats[];
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 10;
}

export async function getPhase4Snapshot(userId: UserId): Promise<Phase4Snapshot> {
  const [capture, rules, prompts, failures] = await Promise.all([
    getCaptureBreakdown(userId),
    getRuleStats(userId),
    getPromptStats(userId),
    getFailureStats(userId),
  ]);

  const total = capture.total;

  let uncategorized = 0;
  let uncategorizedLearnable = 0;
  for (const row of capture.uncategorizedByMerchant) {
    uncategorized += row.n;
    if (row.merchant && isLearnableMerchantKey(row.merchant)) {
      uncategorizedLearnable += row.n;
    }
  }

  const autoCategorized =
    capture.byCategorizedBy.find((row) => row.categorizedBy === 'rule_engine')?.n ?? 0;

  return {
    total,
    bySource: capture.bySource.map((row) => ({ ...row, pct: pct(row.n, total) })),
    byLevel: capture.byCategorizedBy.map((row) => ({
      level: row.categorizedBy ?? 'uncategorized',
      n: row.n,
      pct: pct(row.n, total),
    })),
    autoCategorizedRate: pct(autoCategorized, total),
    uncategorized,
    uncategorizedLearnable,
    uncategorizedUnnameable: uncategorized - uncategorizedLearnable,
    rules,
    prompts,
    failures,
  };
}
