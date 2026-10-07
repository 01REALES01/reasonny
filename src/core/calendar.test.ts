import { describe, expect, it } from 'vitest';

import { buildMonthGrid, isDayKey, monthOffsetForDay, topCategories } from './calendar';

describe('buildMonthGrid', () => {
  it('starts on Monday: 1 October 2026 is a Thursday', () => {
    const [firstWeek] = buildMonthGrid('2026-10');
    expect(firstWeek).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  });

  it('covers every day once, in full weeks', () => {
    const weeks = buildMonthGrid('2026-10');
    const days = weeks.flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days.at(-1)).toBe('2026-10-31');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('knows February in a leap year, and a month that starts on Monday', () => {
    const weeks = buildMonthGrid('2028-02');
    expect(weeks.flat().filter(Boolean)).toHaveLength(29);
    // 1 June 2026 is a Monday: no leading blanks.
    expect(buildMonthGrid('2026-06')[0]![0]).toBe('2026-06-01');
  });
});

describe('topCategories', () => {
  const cat = (id: string) => ({ id, icon: id, color: `var(--${id})` });
  const tx = (amountMinor: bigint, category: ReturnType<typeof cat> | null, type = 'expense') => ({
    type,
    amountMinor,
    currency: 'COP',
    category,
  });

  it('adds up each category and puts the largest first', () => {
    const result = topCategories(
      [tx(1_000_000n, cat('coffee')), tx(5_000_000n, cat('market')), tx(1_500_000n, cat('coffee'))],
      'COP',
      2,
    );
    expect(result.map((c) => [c.icon, c.amount.minor])).toEqual([
      ['market', 5_000_000n],
      ['coffee', 2_500_000n],
    ]);
  });

  it('leaves out income, uncategorised spends and anything past the limit', () => {
    const result = topCategories(
      [
        tx(9_000_000n, cat('salary'), 'income'),
        tx(8_000_000n, null),
        tx(1_000_000n, cat('a')),
        tx(2_000_000n, cat('b')),
        tx(3_000_000n, cat('c')),
      ],
      'COP',
      2,
    );
    expect(result.map((c) => c.icon)).toEqual(['c', 'b']);
  });

  it('does not add another currency into the base one', () => {
    const usd = { ...tx(100n, cat('travel')), currency: 'USD' };
    expect(topCategories([usd], 'COP', 2)).toEqual([]);
  });
});

describe('monthOffsetForDay', () => {
  it('counts months back from today, across a year boundary', () => {
    expect(monthOffsetForDay('2026-10-05', '2026-10-06')).toBe(0);
    expect(monthOffsetForDay('2026-09-28', '2026-10-01')).toBe(-1);
    expect(monthOffsetForDay('2025-12-31', '2026-01-02')).toBe(-1);
  });

  it('never points to the future', () => {
    expect(monthOffsetForDay('2026-12-01', '2026-10-06')).toBe(0);
  });
});

describe('isDayKey', () => {
  it('accepts real dates only', () => {
    expect(isDayKey('2026-10-06')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('6/10/2026')).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });
});
