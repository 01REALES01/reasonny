import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/telemetry.repository', () => ({
  recordTelemetryEvent: vi.fn(),
  getMetricPercentiles: vi.fn(),
  getDailyUsage: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  getCaptureBreakdown: vi.fn(),
}));

vi.mock('@/core/repositories/categorization-rule.repository', () => ({
  getRuleStats: vi.fn(),
}));

vi.mock('@/core/repositories/notification-prompt.repository', () => ({
  getPromptStats: vi.fn(),
}));

vi.mock('@/core/repositories/ingestion-failure.repository', () => ({
  getFailureStats: vi.fn(),
}));

import {
  getDailyUsage,
  getMetricPercentiles,
  recordTelemetryEvent,
} from '@/core/repositories/telemetry.repository';
import { toUserId } from '@/core/types';

import { getRuleStats } from '@/core/repositories/categorization-rule.repository';
import { getFailureStats } from '@/core/repositories/ingestion-failure.repository';
import { getPromptStats } from '@/core/repositories/notification-prompt.repository';
import { getCaptureBreakdown } from '@/core/repositories/transaction.repository';

import {
  getPhase1Baselines,
  getPhase4Snapshot,
  recordMetric,
  recordMetrics,
} from './telemetry.service';

describe('Telemetry Service', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');

  beforeEach(() => {
    vi.clearAllMocks();
    (recordTelemetryEvent as any).mockResolvedValue({ id: 'evt-1' });
  });

  describe('recordMetric', () => {
    it('converts the browser value to the stored fixed-point scale', () => {
      return recordMetric(userId, {
        metric: 'LCP',
        value: 2431.7,
        rating: 'good',
        route: '/',
      }).then(() => {
        expect(recordTelemetryEvent).toHaveBeenCalledWith(userId, {
          metric: 'LCP',
          valueScaled: 2_431_700n,
          rating: 'good',
          route: '/',
          metadata: null,
        });
      });
    });

    it('normalises omitted optional fields to null rather than undefined', async () => {
      // undefined would make Drizzle skip the column and fall back to whatever
      // default exists, which is not the same statement as "we know it is
      // absent".
      await recordMetric(userId, { metric: 'CLS', value: 0.083 });

      expect(recordTelemetryEvent).toHaveBeenCalledWith(userId, {
        metric: 'CLS',
        valueScaled: 83n,
        rating: null,
        route: null,
        metadata: null,
      });
    });

    it('propagates a rejected value instead of writing a zero', async () => {
      await expect(
        recordMetric(userId, { metric: 'INP', value: Number.NaN }),
      ).rejects.toThrow(RangeError);
      expect(recordTelemetryEvent).not.toHaveBeenCalled();
    });
  });

  describe('recordMetrics', () => {
    it('records every sample in a well-formed batch', async () => {
      await recordMetrics(userId, [
        { metric: 'LCP', value: 2000 },
        { metric: 'INP', value: 120 },
        { metric: 'CLS', value: 0.05 },
      ]);

      expect(recordTelemetryEvent).toHaveBeenCalledTimes(3);
    });

    it('handles an empty batch without touching the database', async () => {
      await expect(recordMetrics(userId, [])).resolves.toEqual({ failed: [] });
      expect(recordTelemetryEvent).not.toHaveBeenCalled();
    });

    it('names the refused metric and still writes the rest of the batch', async () => {
      // The real per-row failure: these are independent INSERTs, so a CHECK
      // violation on one sample commits the others. The name is what makes a
      // beacon failure diagnosable at all.
      (recordTelemetryEvent as any).mockImplementation(
        (_u: unknown, input: { metric: string }) => {
          if (input.metric === 'CLS') {
            return Promise.reject(new Error('violates check constraint'));
          }
          return Promise.resolve({});
        },
      );

      const { failed } = await recordMetrics(userId, [
        { metric: 'LCP', value: 2000 },
        { metric: 'CLS', value: 0.05 },
        { metric: 'INP', value: 120 },
      ]);

      expect(failed).toEqual(['CLS']);
      expect(recordTelemetryEvent).toHaveBeenCalledTimes(3);
    });

    // No per-sample partial-failure test any more. The three that were here
    // fed NaN, -5 and Infinity to this function directly, which the only
    // caller cannot do: the route validates with
    // z.number().finite().min(0).max(86_400_000) first. What they proved was
    // that the machinery worked, not that anything needed it.
    //
    // The guard those inputs were really testing lives one level down, on
    // recordMetric, and is still asserted above. api/v1/telemetry/route.test.ts
    // covers the rejection at the edge where it actually happens.
  });

  describe('getPhase1Baselines', () => {
    function percentilesFor(metric: string, n: number, p50: bigint | null) {
      return {
        metric,
        n,
        p50Scaled: p50,
        p75Scaled: p50,
        p95Scaled: p50,
        minScaled: p50,
        maxScaled: p50,
      };
    }

    it('converts stored values back into the metric’s own unit', async () => {
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) => {
        if (metric === 'LCP') return percentilesFor('LCP', 12, 2_431_700n);
        if (metric === 'CLS') return percentilesFor('CLS', 12, 83n);
        return percentilesFor(metric, 0, null);
      });
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 3, daysElapsed: 4 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');

      const lcp = baselines.webVitals.find((m) => m.metric === 'LCP');
      const cls = baselines.webVitals.find((m) => m.metric === 'CLS');

      expect(lcp?.p75).toBeCloseTo(2431.7, 3);
      expect(lcp?.unit).toBe('ms');
      expect(cls?.p75).toBeCloseTo(0.083, 3);
      expect(cls?.unit).toBe('ratio');
    });

    it('attaches n to every summary, as P6 requires', async () => {
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) =>
        percentilesFor(metric, 47, 1_000n),
      );
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 3, daysElapsed: 4 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');

      expect(baselines.manualEntryDuration.n).toBe(47);
      expect(baselines.dashboardQueryDuration.n).toBe(47);
      for (const vital of baselines.webVitals) {
        expect(vital.n).toBe(47);
      }
    });

    it('reports budget compliance from p75, not p50', async () => {
      // P7 is defined on the 75th percentile of real users. A p50 that passes
      // while p75 fails is exactly the case this must not report as green.
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) => ({
        metric,
        n: 10,
        p50Scaled: 100_000n, // 100ms - inside the INP budget
        p75Scaled: 350_000n, // 350ms - outside it
        p95Scaled: 400_000n,
        minScaled: 90_000n,
        maxScaled: 400_000n,
      }));
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 1, daysElapsed: 1 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');
      const inp = baselines.webVitals.find((m) => m.metric === 'INP');

      expect(inp?.p50).toBe(100);
      expect(inp?.p75).toBe(350);
      expect(inp?.budget?.meets).toBe(false);
    });

    it('reports an unmeasured budget as null, never as a failure', async () => {
      // "No reading yet" and "failing the budget" are different states, and
      // publishing the first as the second would violate P6.
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) =>
        percentilesFor(metric, 0, null),
      );
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 0, daysElapsed: 0 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');
      const lcp = baselines.webVitals.find((m) => m.metric === 'LCP');

      expect(lcp?.n).toBe(0);
      expect(lcp?.p75).toBeNull();
      expect(lcp?.budget?.meets).toBeNull();
    });

    it('leaves the two duration metrics without a budget block', async () => {
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) =>
        percentilesFor(metric, 5, 3_000n),
      );
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 1, daysElapsed: 1 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');

      expect(baselines.manualEntryDuration.budget).toBeNull();
      expect(baselines.dashboardQueryDuration.budget).toBeNull();
    });

    it('computes the daily usage rate from the transactions table', async () => {
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) =>
        percentilesFor(metric, 1, 1n),
      );
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 3, daysElapsed: 4 });

      const baselines = await getPhase1Baselines(userId, 'America/Bogota');

      expect(baselines.dailyUsage).toEqual({
        daysWithEntry: 3,
        daysElapsed: 4,
        rate: 0.75,
      });
      expect(getDailyUsage).toHaveBeenCalledWith(userId, 'America/Bogota', undefined);
    });

    it('passes the isolation key and the window through to every query', async () => {
      (getMetricPercentiles as any).mockImplementation((_u: unknown, metric: string) =>
        percentilesFor(metric, 1, 1n),
      );
      (getDailyUsage as any).mockResolvedValue({ daysWithEntry: 1, daysElapsed: 1 });

      const since = new Date('2026-08-01T00:00:00Z');
      await getPhase1Baselines(userId, 'America/Bogota', since);

      for (const call of (getMetricPercentiles as any).mock.calls) {
        expect(call[0]).toBe(userId);
        expect(call[2]).toBe(since);
      }
      // The retention rate must respect the same window, or a report headed
      // "since X" would print an all-time figure next to windowed latencies.
      expect(getDailyUsage).toHaveBeenCalledWith(userId, 'America/Bogota', since);
    });
  });
});

/**
 * The phase-4 snapshot is what fills METRICS.md, so a wrong number here does
 * not crash anything - it becomes a claim in a document, which is worse.
 */
describe('the phase 4 snapshot', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuleStats).mockResolvedValue({ rules: 9, hits: 4 });
    vi.mocked(getPromptStats).mockResolvedValue([]);
    vi.mocked(getFailureStats).mockResolvedValue([]);
    vi.mocked(getCaptureBreakdown).mockResolvedValue({
      total: 0,
      bySource: [],
      byCategorizedBy: [],
      uncategorizedByMerchant: [],
    });
  });

  it('separates what a rule could learn from what nobody but the person knows', async () => {
    // The whole honesty of the level 1 metric. "Transferencia enviada" is a
    // placeholder the bank never named: counting it against the rule engine
    // would report a failure that is not the engine's to answer for.
    vi.mocked(getCaptureBreakdown).mockResolvedValue({
      total: 10,
      bySource: [{ source: 'sms_shortcut', n: 10 }],
      byCategorizedBy: [{ categorizedBy: null, n: 10 }],
      uncategorizedByMerchant: [
        { merchant: 'transferencia enviada', n: 5 },
        { merchant: 'retiro en cajero', n: 2 },
        { merchant: 'juan valdez', n: 3 },
      ],
    });

    const snapshot = await getPhase4Snapshot(userId);

    expect(snapshot.uncategorized).toBe(10);
    expect(snapshot.uncategorizedLearnable).toBe(3);
    expect(snapshot.uncategorizedUnnameable).toBe(7);
  });

  it('counts a merchant it has no key for as unnameable, not as learnable', async () => {
    vi.mocked(getCaptureBreakdown).mockResolvedValue({
      total: 2,
      bySource: [],
      byCategorizedBy: [],
      uncategorizedByMerchant: [{ merchant: null, n: 2 }],
    });

    const snapshot = await getPhase4Snapshot(userId);

    expect(snapshot.uncategorizedLearnable).toBe(0);
    expect(snapshot.uncategorizedUnnameable).toBe(2);
  });

  it('reports the level 1 rate off rule_engine alone', async () => {
    vi.mocked(getCaptureBreakdown).mockResolvedValue({
      total: 63,
      bySource: [
        { source: 'sms_shortcut', n: 49 },
        { source: 'telegram_text', n: 3 },
      ],
      byCategorizedBy: [
        { categorizedBy: 'manual', n: 32 },
        { categorizedBy: null, n: 28 },
        { categorizedBy: 'rule_engine', n: 3 },
      ],
      uncategorizedByMerchant: [],
    });

    const snapshot = await getPhase4Snapshot(userId);

    expect(snapshot.autoCategorizedRate).toBe(4.8);
    expect(snapshot.bySource[0]).toEqual({ source: 'sms_shortcut', n: 49, pct: 77.8 });
    // A null categorized_by is a real bucket in the report, not a missing row.
    expect(snapshot.byLevel).toContainEqual({ level: 'uncategorized', n: 28, pct: 44.4 });
  });

  it('answers 0% rather than NaN on an empty ledger', async () => {
    // A fresh profile reads this before it has spent anything, and a NaN in
    // METRICS.md is worse than a zero: it looks like a bug in the app.
    const snapshot = await getPhase4Snapshot(userId);

    expect(snapshot.autoCategorizedRate).toBe(0);
    expect(snapshot.total).toBe(0);
  });
});
