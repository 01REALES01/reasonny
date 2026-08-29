import { describe, expect, it } from 'vitest';

import {
  SCALE,
  add,
  compare,
  equals,
  formatMoney,
  isNegative,
  isZero,
  money,
  negate,
  parseMoney,
  subtract,
  sum,
  toDecimalString,
  zero,
  type Money,
} from './money';

const cop = (minor: bigint): Money => money(minor, 'COP');
const usd = (minor: bigint): Money => money(minor, 'USD');
/**
 * Intl separates the symbol from the digits with a NARROW NO-BREAK SPACE, not a
 * regular one, so a hardcoded ' ' in an expectation fails against a string that
 * looks identical on screen. Normalise rather than paste an invisible character
 * into the test.
 */
const fmt = (...args: Parameters<typeof formatMoney>): string =>
  formatMoney(...args).replace(/[\u00A0\u202F]/g, ' ');

describe('the reason this module exists', () => {
  it('does in integers what floats get wrong', () => {
    // The canonical IEEE 754 failure, for the record.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(add(cop(10n), cop(20n)).minor).toBe(30n);
  });

  it('survives amounts past 2^53, where a JS number silently stops being exact', () => {
    const huge = 9_007_199_254_740_993n; // Number.MAX_SAFE_INTEGER + 2
    // The precision is already gone before any arithmetic runs: JS cannot even
    // hold this literal as a number, so it silently becomes ...992.
    expect(Number(huge)).toBe(9_007_199_254_740_992);
    expect(huge.toString()).toBe('9007199254740993');
    // The bigint path keeps every unit.
    expect(add(cop(huge), cop(1n)).minor).toBe(9_007_199_254_740_994n);
  });

  it('keeps the scale at 100 for every currency', () => {
    expect(SCALE).toBe(100n);
    expect(parseMoney('45000', 'COP').minor).toBe(4_500_000n);
  });
});

describe('construction', () => {
  it('builds and zeroes', () => {
    expect(money(4_500_000n, 'COP')).toEqual({ minor: 4_500_000n, currency: 'COP' });
    expect(zero('USD')).toEqual({ minor: 0n, currency: 'USD' });
  });

  it('rejects anything that is not a three-letter uppercase code', () => {
    expect(() => money(1n, 'cop')).toThrow(/Invalid currency/);
    expect(() => money(1n, 'COPX')).toThrow(/Invalid currency/);
    expect(() => money(1n, '')).toThrow(/Invalid currency/);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and negates', () => {
    expect(add(cop(4_500_000n), cop(500_000n)).minor).toBe(5_000_000n);
    expect(subtract(cop(4_500_000n), cop(500_000n)).minor).toBe(4_000_000n);
    expect(subtract(cop(100n), cop(300n)).minor).toBe(-200n);
    expect(negate(cop(100n)).minor).toBe(-100n);
    expect(negate(cop(-100n)).minor).toBe(100n);
  });

  // Without this guard a COP + USD sum produces a number that looks fine and
  // means nothing.
  it('refuses to mix currencies', () => {
    expect(() => add(cop(1n), usd(1n))).toThrow(/different currencies/);
    expect(() => subtract(cop(1n), usd(1n))).toThrow(/different currencies/);
    expect(() => compare(cop(1n), usd(1n))).toThrow(/different currencies/);
  });

  it('answers the predicates', () => {
    expect(isZero(zero('COP'))).toBe(true);
    expect(isZero(cop(1n))).toBe(false);
    expect(isNegative(cop(-1n))).toBe(true);
    expect(isNegative(cop(0n))).toBe(false);
  });

  it('compares and equates', () => {
    expect(compare(cop(1n), cop(2n))).toBe(-1);
    expect(compare(cop(2n), cop(1n))).toBe(1);
    expect(compare(cop(2n), cop(2n))).toBe(0);
    expect(equals(cop(2n), cop(2n))).toBe(true);
    expect(equals(cop(2n), cop(3n))).toBe(false);
    // Different currency is not equal, and must not throw: equals is a question,
    // not an operation.
    expect(equals(cop(2n), usd(2n))).toBe(false);
  });

  it('sums a list, including the empty one', () => {
    expect(sum([], 'COP')).toEqual(zero('COP'));
    expect(sum([cop(100n), cop(200n), cop(300n)], 'COP').minor).toBe(600n);
  });
});

describe('parseMoney - what a human types', () => {
  it('reads plain digits', () => {
    expect(parseMoney('45000', 'COP').minor).toBe(4_500_000n);
    expect(parseMoney('0', 'COP').minor).toBe(0n);
  });

  // The Colombian case: "." groups thousands, it is not a decimal point.
  it('treats a single dot before exactly three digits as grouping', () => {
    expect(parseMoney('45.000', 'COP').minor).toBe(4_500_000n);
    expect(parseMoney('1.234', 'COP').minor).toBe(123_400n);
  });

  it('treats it as a decimal separator otherwise', () => {
    expect(parseMoney('45.00', 'USD').minor).toBe(4_500n);
    expect(parseMoney('45.5', 'USD').minor).toBe(4_550n);
    expect(parseMoney('.50', 'USD').minor).toBe(50n);
  });

  it('reads a comma the same way', () => {
    expect(parseMoney('45,000', 'COP').minor).toBe(4_500_000n);
    expect(parseMoney('0,50', 'COP').minor).toBe(50n);
    expect(parseMoney(',50', 'COP').minor).toBe(50n);
  });

  it('a repeated separator can only be grouping', () => {
    expect(parseMoney('1.000.000', 'COP').minor).toBe(100_000_000n);
    expect(parseMoney('1,000,000', 'COP').minor).toBe(100_000_000n);
  });

  it('when both appear, the last one is the decimal separator', () => {
    expect(parseMoney('1.234.567,89', 'COP').minor).toBe(123_456_789n);
    expect(parseMoney('1,234,567.89', 'USD').minor).toBe(123_456_789n);
  });

  it('ignores symbols, codes and spaces', () => {
    expect(parseMoney('$45.000', 'COP').minor).toBe(4_500_000n);
    expect(parseMoney('  $ 45.000 COP ', 'COP').minor).toBe(4_500_000n);
    expect(parseMoney('45.000 $', 'COP').minor).toBe(4_500_000n);
  });

  it('reads the sign on either side of the symbol', () => {
    expect(parseMoney('-45.000', 'COP').minor).toBe(-4_500_000n);
    expect(parseMoney('$-45.000', 'COP').minor).toBe(-4_500_000n);
    expect(parseMoney('-$45.000', 'COP').minor).toBe(-4_500_000n);
    expect(parseMoney('-0', 'COP').minor).toBe(0n);
  });

  it('refuses what it cannot read instead of guessing', () => {
    expect(() => parseMoney('', 'COP')).toThrow(/Cannot read an amount/);
    expect(() => parseMoney('abc', 'COP')).toThrow(/Cannot read an amount/);
    expect(() => parseMoney('-', 'COP')).toThrow(/Cannot read an amount/);
    expect(() => parseMoney('.', 'COP')).toThrow(/Cannot read an amount/);
  });

  // Accepting this would silently drop money the user actually typed.
  it('refuses more precision than a cent', () => {
    expect(() => parseMoney('45.0001', 'USD')).toThrow(/more than two decimals/);
    expect(() => parseMoney('1,234.5678', 'USD')).toThrow(/more than two decimals/);
  });

  it('validates the currency too', () => {
    expect(() => parseMoney('1', 'xx')).toThrow(/Invalid currency/);
  });

  it('round-trips through formatting', () => {
    const original = cop(1_847_300n);
    expect(parseMoney(formatMoney(original, 'es-CO'), 'COP')).toEqual(original);
  });
});

describe('toDecimalString - the plain decimal, no locale', () => {
  // Moved here with the function, which the CSV export used to duplicate. The
  // export is the one consumer that must NOT go through Intl: a spreadsheet
  // needs 45000.00, not "$ 45.000".
  it('always emits exactly two decimals', () => {
    expect(toDecimalString(4_500_000n)).toBe('45000.00');
    expect(toDecimalString(1250n)).toBe('12.50');
    expect(toDecimalString(5n)).toBe('0.05');
    expect(toDecimalString(0n)).toBe('0.00');
  });

  it('keeps the sign on the whole amount, not on the cents', () => {
    expect(toDecimalString(-4_500_000n)).toBe('-45000.00');
    expect(toDecimalString(-50n)).toBe('-0.50');
  });

  it('stays exact past the range a double can represent', () => {
    // 2^53 minor units is about 90 billion pesos. A number would round here.
    expect(toDecimalString(9_007_199_254_740_993n)).toBe('90071992547409.93');
  });
});

describe('formatMoney', () => {
  // COP does not use cents in practice, so the default drops them - even though
  // CLDR declares two fraction digits for it.
  it('renders COP without cents', () => {
    expect(fmt(cop(4_500_000n), 'es-CO')).toBe('$ 45.000');
  });

  it('renders a currency that does use cents with them', () => {
    expect(fmt(usd(4_500n), 'en-US')).toBe('$45.00');
  });

  it('follows the locale, never a hardcoded format', () => {
    expect(fmt(usd(123_456_789n), 'en-US')).toBe('$1,234,567.89');
    expect(fmt(usd(123_456_789n), 'es-CO')).toContain('1.234.567,89');
  });

  it('accepts an explicit override of the fraction digits', () => {
    expect(fmt(cop(4_500_050n), 'es-CO', { fractionDigits: 2 })).toBe('$ 45.000,50');
    expect(fmt(usd(4_500n), 'en-US', { fractionDigits: 0 })).toBe('$45');
  });

  it('renders negatives', () => {
    expect(fmt(cop(-4_500_000n), 'es-CO')).toContain('45.000');
    expect(fmt(cop(-4_500_000n), 'es-CO')).toMatch(/-/);
  });

  it('stays exact past 2^53, where a float would drift', () => {
    expect(fmt(usd(9_007_199_254_740_993n), 'en-US')).toBe('$90,071,992,547,409.93');
  });
});
