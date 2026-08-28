import { describe, expect, it } from 'vitest';

import {
  computeDailyUsageRate,
  fromScaledValue,
  hasPerformanceBudget,
  isTelemetryMetric,
  isTelemetryRating,
  meetsPerformanceBudget,
  PERFORMANCE_BUDGET,
  TELEMETRY_METRICS,
  TELEMETRY_SCALE,
  toScaledValue,
} from './telemetry';

describe('Telemetry scaling', () => {
  it('scales a fractional millisecond duration to an exact integer', () => {
    // A realistic LCP: web-vitals reports fractional milliseconds.
    expect(toScaledValue(2431.7)).toBe(2_431_700n);
  });

  it('scales a CLS ratio without losing the third decimal', () => {
    // 0.098 passes the P7 budget of 0.1 and 0.101 does not. If the scale ever
    // dropped to two decimals both would store as 0.10 and the budget check
    // would stop being able to tell them apart.
    expect(toScaledValue(0.098)).toBe(98n);
    expect(toScaledValue(0.101)).toBe(101n);
  });

  it('rounds rather than truncates, so the baseline is not biased downward', () => {
    expect(toScaledValue(1.9999)).toBe(2000n);
    expect(toScaledValue(0.0006)).toBe(1n);
  });

  it('stores an exact zero', () => {
    // A CLS of 0 is the ideal outcome, not a missing reading.
    expect(toScaledValue(0)).toBe(0n);
  });

  it('rejects a negative value instead of clamping it to zero', () => {
    // Clamping would insert a fabricated instant sample into the percentiles.
    expect(() => toScaledValue(-1)).toThrow(RangeError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => toScaledValue(Number.NaN)).toThrow(RangeError);
    expect(() => toScaledValue(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('round-trips a value through both conversions', () => {
    expect(fromScaledValue(toScaledValue(2431.7))).toBeCloseTo(2431.7, 3);
    expect(fromScaledValue(toScaledValue(0.083))).toBeCloseTo(0.083, 3);
  });

  it('keeps the scale at 1000, which the schema CHECK and comments assume', () => {
    expect(TELEMETRY_SCALE).toBe(1000n);
  });
});

describe('Telemetry metric guards', () => {
  it('accepts every metric the schema CHECK allows', () => {
    for (const metric of TELEMETRY_METRICS) {
      expect(isTelemetryMetric(metric)).toBe(true);
    }
  });

  it('rejects a metric name the database would refuse', () => {
    // The guard exists so a bad name fails at the API edge with a warning,
    // rather than as a constraint violation inside a fire-and-forget write.
    expect(isTelemetryMetric('FID')).toBe(false);
    expect(isTelemetryMetric('')).toBe(false);
    expect(isTelemetryMetric(42)).toBe(false);
    expect(isTelemetryMetric(null)).toBe(false);
  });

  it('accepts only the three web-vitals ratings', () => {
    expect(isTelemetryRating('good')).toBe(true);
    expect(isTelemetryRating('needs-improvement')).toBe(true);
    expect(isTelemetryRating('poor')).toBe(true);
    expect(isTelemetryRating('bad')).toBe(false);
    expect(isTelemetryRating(undefined)).toBe(false);
  });
});

describe('P7 performance budget', () => {
  it('encodes the thresholds CLAUDE.md states', () => {
    expect(PERFORMANCE_BUDGET.LCP).toEqual({ budget: 2500, failing: 4000, unit: 'ms' });
    expect(PERFORMANCE_BUDGET.INP).toEqual({ budget: 200, failing: 500, unit: 'ms' });
    expect(PERFORMANCE_BUDGET.CLS).toEqual({ budget: 0.1, failing: 0.25, unit: 'ratio' });
  });

  it('knows which metrics carry a budget and which do not', () => {
    expect(hasPerformanceBudget('LCP')).toBe(true);
    expect(hasPerformanceBudget('CLS')).toBe(true);
    // TTFB and the two durations are diagnostics, not budgeted by P7.
    expect(hasPerformanceBudget('TTFB')).toBe(false);
    expect(hasPerformanceBudget('manual_entry_duration')).toBe(false);
  });

  it('treats a value exactly on the budget as passing', () => {
    // "< 2.5s" in prose, but a p75 landing precisely on the line is not a
    // regression, and rejecting it would make the gate flap on rounding.
    expect(meetsPerformanceBudget('LCP', 2500)).toBe(true);
    expect(meetsPerformanceBudget('LCP', 2500.001)).toBe(false);
  });

  it('fails INP above 200ms, the metric CLAUDE.md calls the critical one', () => {
    expect(meetsPerformanceBudget('INP', 180)).toBe(true);
    expect(meetsPerformanceBudget('INP', 201)).toBe(false);
  });
});

describe('Daily usage rate', () => {
  it('reports a perfect streak as 1', () => {
    expect(computeDailyUsageRate(7, 7)).toBe(1);
  });

  it('reports the first day of use as 1/1, not a division by zero', () => {
    expect(computeDailyUsageRate(1, 1)).toBe(1);
  });

  it('returns 0 rather than NaN when nothing has been recorded', () => {
    // A NaN here would propagate into METRICS.md as a published number.
    expect(computeDailyUsageRate(0, 0)).toBe(0);
    expect(Number.isNaN(computeDailyUsageRate(0, 0))).toBe(false);
  });

  it('reports a partial streak as a fraction', () => {
    expect(computeDailyUsageRate(3, 7)).toBeCloseTo(0.4286, 4);
  });

  it('guards against a negative elapsed window', () => {
    expect(computeDailyUsageRate(1, -3)).toBe(0);
  });
});
