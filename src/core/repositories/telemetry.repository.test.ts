import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/infrastructure/db/client', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  return { getDb: vi.fn(() => mockDb) };
});

import { toUserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';

import {
  getDailyUsage,
  getMetricPercentiles,
  recordTelemetryEvent,
} from './telemetry.repository';

describe('Telemetry Repository', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');
  let mockDb: ReturnType<typeof getDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = getDb();
  });

  describe('recordTelemetryEvent', () => {
    it('writes the sample under the caller’s userId', async () => {
      const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'evt-1', userId, metric: 'LCP' }]),
      };
      (mockDb.insert as any).mockReturnValue(chain);

      await recordTelemetryEvent(userId, {
        metric: 'LCP',
        valueScaled: 2_431_700n,
        rating: 'good',
        route: '/',
      });

      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ userId, metric: 'LCP', valueScaled: 2_431_700n }),
      );
    });

    it('does not use onConflict: telemetry is an append-only log', async () => {
      // Two identical readings from two page loads are two facts. Deduplicating
      // them the way transactions are deduplicated would bias n downward.
      const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'evt-1' }]),
      };
      (mockDb.insert as any).mockReturnValue(chain);

      await recordTelemetryEvent(userId, { metric: 'INP', valueScaled: 120_000n });

      expect(chain).not.toHaveProperty('onConflictDoNothing');
      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ rating: null, route: null, metadata: null }),
      );
    });

    it('throws rather than returning silently when nothing was inserted', async () => {
      const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      (mockDb.insert as any).mockReturnValue(chain);

      await expect(
        recordTelemetryEvent(userId, { metric: 'LCP', valueScaled: 1n }),
      ).rejects.toThrow(/Failed to record telemetry event/);
    });
  });

  describe('getMetricPercentiles', () => {
    function mockSelectResult(row: unknown) {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([row]),
      };
      (mockDb.select as any).mockReturnValue(chain);
      return chain;
    }

    it('returns the percentiles and the sample size together', async () => {
      mockSelectResult({
        n: 12,
        p50: 2_000_000n,
        p75: 2_431_700n,
        p95: 3_100_000n,
        minValue: 1_500_000n,
        maxValue: 3_400_000n,
      });

      const result = await getMetricPercentiles(userId, 'LCP');

      expect(result.n).toBe(12);
      expect(result.p75Scaled).toBe(2_431_700n);
      expect(result.metric).toBe('LCP');
    });

    it('filters by the caller’s userId', async () => {
      const chain = mockSelectResult({ n: 0, p50: null, p75: null, p95: null });

      await getMetricPercentiles(userId, 'INP');

      // The isolation barrier: the WHERE clause must be built, every time.
      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(chain.where.mock.calls[0]?.[0]).toBeDefined();
    });

    it('reports an empty table as n=0 with null percentiles, not zeros', async () => {
      // A p50 of 0 would read as "the page loads instantly". Null reads as
      // "nothing has been measured", which is the truth.
      mockSelectResult({
        n: 0,
        p50: null,
        p75: null,
        p95: null,
        minValue: null,
        maxValue: null,
      });

      const result = await getMetricPercentiles(userId, 'CLS');

      expect(result.n).toBe(0);
      expect(result.p50Scaled).toBeNull();
      expect(result.p95Scaled).toBeNull();
    });

    it('survives a query that returns no row at all', async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      (mockDb.select as any).mockReturnValue(chain);

      const result = await getMetricPercentiles(userId, 'FCP');

      expect(result).toEqual({
        metric: 'FCP',
        n: 0,
        p50Scaled: null,
        p75Scaled: null,
        p95Scaled: null,
        minScaled: null,
        maxScaled: null,
      });
    });

    it('coerces a driver-supplied string percentile into bigint', async () => {
      // Postgres returns bigint over the wire as a string in some driver
      // configurations. Left as a string it would silently become "2431700"
      // and break every comparison downstream.
      mockSelectResult({ n: 3, p50: '2431700', p75: '2431700', p95: '2431700' });

      const result = await getMetricPercentiles(userId, 'LCP');

      expect(result.p50Scaled).toBe(2_431_700n);
      expect(typeof result.p50Scaled).toBe('bigint');
    });
  });

  describe('getDailyUsage', () => {
    it('returns the two counts the retention baseline needs', async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ daysWithEntry: 3, daysElapsed: 4 }]),
      };
      (mockDb.select as any).mockReturnValue(chain);

      const result = await getDailyUsage(userId, 'America/Bogota');

      expect(result).toEqual({ daysWithEntry: 3, daysElapsed: 4 });
    });

    it('returns zeros for a user who has recorded nothing', async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ daysWithEntry: 0, daysElapsed: 0 }]),
      };
      (mockDb.select as any).mockReturnValue(chain);

      const result = await getDailyUsage(userId, 'America/Bogota');

      expect(result).toEqual({ daysWithEntry: 0, daysElapsed: 0 });
    });
  });
});
