import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/telemetry.repository', () => ({
  recordTelemetryEvent: vi.fn(),
  getMetricPercentiles: vi.fn(),
  getDailyUsage: vi.fn(),
}));

import {
  getDailyUsage,
  getMetricPercentiles,
  recordTelemetryEvent,
} from '@/core/repositories/telemetry.repository';
import { toUserId } from '@/core/types';

import {
  getPhase1Baselines,
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
      const result = await recordMetrics(userId, [
        { metric: 'LCP', value: 2000 },
        { metric: 'INP', value: 120 },
        { metric: 'CLS', value: 0.05 },
      ]);

      expect(result.recorded).toBe(3);
      expect(result.rejected).toEqual([]);
      expect(recordTelemetryEvent).toHaveBeenCalledTimes(3);
    });

    it('keeps the good samples when one in the batch is invalid', async () => {
      // The scenario this exists for: a browser reports one metric as NaN and
      // the beacon carries the other four. Rejecting the payload wholesale
      // would lose them silently at unload.
      const result = await recordMetrics(userId, [
        { metric: 'LCP', value: 2000 },
        { metric: 'INP', value: -5 },
        { metric: 'CLS', value: 0.05 },
      ]);

      expect(result.recorded).toBe(2);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0]?.metric).toBe('INP');
    });

    it('names the failing metric so the log identifies it', async () => {
      const result = await recordMetrics(userId, [
        { metric: 'TTFB', value: Number.POSITIVE_INFINITY },
      ]);

      expect(result.recorded).toBe(0);
      expect(result.rejected[0]?.metric).toBe('TTFB');
      expect(result.rejected[0]?.reason).toMatch(/finite/i);
    });

    it('handles an empty batch without touching the database', async () => {
      const result = await recordMetrics(userId, []);

      expect(result).toEqual({ recorded: 0, rejected: [] });
      expect(recordTelemetryEvent).not.toHaveBeenCalled();
    });
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
