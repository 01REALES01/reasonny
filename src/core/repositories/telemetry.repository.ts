/**
 * Telemetry repository (B9).
 *
 * Like every repository here, userId is the first parameter and the primary
 * isolation barrier. That matters more than usual for this table: telemetry is
 * the one dataset a reader might assume is anonymous aggregate data and query
 * without a tenant filter. It is not. A row here says when a specific person
 * opened their expense form and how long they hesitated.
 */
import { and, eq, gte, sql } from 'drizzle-orm';

import type {
  TelemetryMetric,
  TelemetryRating,
} from '@/core/telemetry';
import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { telemetryEvents, transactions } from '@/infrastructure/db/schema';

export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;

export interface RecordTelemetryEventInput {
  readonly metric: TelemetryMetric;
  readonly valueScaled: bigint;
  readonly rating?: TelemetryRating | null;
  readonly route?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

/**
 * Appends one measurement.
 *
 * Deliberately not idempotent and deliberately not deduplicated. Telemetry is
 * an append-only log of observations: two identical LCP readings from two page
 * loads are two facts, not a duplicate. The idempotency machinery that guards
 * `transactions` would here throw away real samples and bias n downward.
 */
export async function recordTelemetryEvent(
  userId: UserId,
  input: RecordTelemetryEventInput,
): Promise<TelemetryEventRow> {
  const db = getDb();

  const [row] = await db
    .insert(telemetryEvents)
    .values({
      userId,
      metric: input.metric,
      valueScaled: input.valueScaled,
      rating: input.rating ?? null,
      route: input.route ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to record telemetry event "${input.metric}".`);
  }
  return row;
}

export interface MetricPercentiles {
  readonly metric: TelemetryMetric;
  /** Sample size. P6 forbids reporting any of the values below without it. */
  readonly n: number;
  readonly p50Scaled: bigint | null;
  readonly p75Scaled: bigint | null;
  readonly p95Scaled: bigint | null;
  readonly minScaled: bigint | null;
  readonly maxScaled: bigint | null;
}

/**
 * Percentiles for one metric, computed in Postgres.
 *
 * WHY percentile_disc AND NOT percentile_cont
 * -------------------------------------------
 * percentile_cont interpolates between the two samples surrounding the
 * requested rank and returns a double - a number that was never measured. With
 * the sample sizes phase 1 will actually have (one user, tens of readings) that
 * invented value can sit meaningfully far from anything the app ever did.
 * percentile_disc returns an observed sample, stays exactly in bigint, and
 * makes "p95 = 2431.7 ms" a sentence about a real page load.
 *
 * WHY IN SQL AND NOT IN JS
 * ------------------------
 * The same reason monthly totals are aggregated in SQL: pulling every row to
 * sort it in the app is O(n) network for an O(1) answer, and it stops working
 * at precisely the point the numbers get interesting.
 */
export async function getMetricPercentiles(
  userId: UserId,
  metric: TelemetryMetric,
  since?: Date,
): Promise<MetricPercentiles> {
  const db = getDb();

  const toBigIntOrNull = (val: unknown): bigint | null =>
    val === null || val === undefined ? null : BigInt(val as string | number | bigint);

  const [result] = await db
    .select({
      n: sql<number>`COUNT(*)::int`,
      p50: sql<
        bigint | null
      >`percentile_disc(0.5) WITHIN GROUP (ORDER BY ${telemetryEvents.valueScaled})`.mapWith(
        toBigIntOrNull,
      ),
      p75: sql<
        bigint | null
      >`percentile_disc(0.75) WITHIN GROUP (ORDER BY ${telemetryEvents.valueScaled})`.mapWith(
        toBigIntOrNull,
      ),
      p95: sql<
        bigint | null
      >`percentile_disc(0.95) WITHIN GROUP (ORDER BY ${telemetryEvents.valueScaled})`.mapWith(
        toBigIntOrNull,
      ),
      minValue: sql<bigint | null>`MIN(${telemetryEvents.valueScaled})`.mapWith(
        toBigIntOrNull,
      ),
      maxValue: sql<bigint | null>`MAX(${telemetryEvents.valueScaled})`.mapWith(
        toBigIntOrNull,
      ),
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.userId, userId),
        eq(telemetryEvents.metric, metric),
        ...(since ? [gte(telemetryEvents.createdAt, since)] : []),
      ),
    );

  // Coerced again on the way out, not only inside mapWith. Postgres sends
  // bigint over the wire as a string, and whether the driver has already
  // widened it depends on driver configuration this module does not control.
  // Without this the declared `bigint | null` would be a type annotation the
  // function does not actually honour, and the lie would only surface as a
  // comparison quietly failing somewhere downstream.
  return {
    metric,
    n: result?.n ?? 0,
    p50Scaled: toBigIntOrNull(result?.p50),
    p75Scaled: toBigIntOrNull(result?.p75),
    p95Scaled: toBigIntOrNull(result?.p95),
    minScaled: toBigIntOrNull(result?.minValue),
    maxScaled: toBigIntOrNull(result?.maxValue),
  };
}

export interface DailyUsageRow {
  readonly daysWithEntry: number;
  readonly daysElapsed: number;
}

/**
 * The retention baseline: how many distinct local days carry at least one
 * confirmed entry, against how many days have passed since the first one.
 *
 * WHY THIS READS `transactions` AND NOT `telemetry_events`
 * -------------------------------------------------------
 * The question is "is this app being used", and the only honest evidence of
 * that is a financial row the user chose to create. A page view proves the
 * phone was unlocked.
 *
 * The AT TIME ZONE casts are the same rule as every other aggregation here
 * (CLAUDE.md rule 4): an expense entered at 20:00 in Bogota on the 31st is a
 * row dated the 1st in UTC, and counting distinct UTC dates would credit the
 * user with two active days for one evening.
 */
export async function getDailyUsage(
  userId: UserId,
  timezone: string,
  since?: Date,
): Promise<DailyUsageRow> {
  const db = getDb();

  const localDate = sql`((${transactions.transactionDate} AT TIME ZONE ${timezone})::date)`;

  const [result] = await db
    .select({
      daysWithEntry: sql<number>`COUNT(DISTINCT ${localDate})::int`,
      // GREATEST(..., 1) because a transaction dated in the future makes
      // "today minus the earliest entry" zero or negative, and the report would
      // then print "1/0 days, rate 0.0%" - a division that reads as total
      // disuse for a user who did record something. The entry form accepts a
      // caller-supplied date, so this is reachable without anything being
      // corrupt. COALESCE still returns 0 for the genuinely empty case.
      daysElapsed: sql<number>`
        COALESCE(
          GREATEST(
            ((NOW() AT TIME ZONE ${timezone})::date - MIN(${localDate}) + 1),
            1
          ),
          0
        )::int
      `,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, 'confirmed'),
        sql`${transactions.deletedAt} IS NULL`,
        // Windowed by the same bound as the percentile queries, so a report
        // headed "since 2026-08-01" does not mix an all-time retention rate in
        // with windowed latencies.
        ...(since ? [gte(transactions.transactionDate, since)] : []),
      ),
    );

  return {
    daysWithEntry: result?.daysWithEntry ?? 0,
    daysElapsed: result?.daysElapsed ?? 0,
  };
}
