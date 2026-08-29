/**
 * Money arithmetic. The only module allowed to do it.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * IEEE 754 doubles cannot represent 0.1 exactly, so 0.1 + 0.2 === 0.30000000000000004.
 * One such error is invisible; ten thousand of them make a balance that does not
 * match the bank, and there is no way to tell which transaction was wrong.
 *
 * So money is stored and manipulated as an INTEGER number of minor units, with a
 * fixed scale of 100: $45.000 COP is 4_500_000n. Integers are exact; there is no
 * rounding until the very last step, which is display.
 *
 * The scale is 100 for every currency, including COP, which does not use cents in
 * practice. A fixed scale means no currency-dependent branch in the arithmetic;
 * COP amounts simply always end in 00. That trade is deliberate.
 *
 * bigint rather than number: a JS number is exact only up to 2^53, which is about
 * 90 billion pesos. That is reachable, and the failure is silent.
 */

/** Minor units per major unit. Fixed for every currency - see the header. */
export const SCALE = 100n;

export interface Money {
  readonly minor: bigint;
  readonly currency: string;
}

/**
 * Currencies whose minor unit is not used in daily practice, so amounts are
 * displayed without it. CLDR says COP has 2 fraction digits; Colombia writes
 * whole pesos. Display only - storage is always scale 100.
 */
const DISPLAY_FRACTION_DIGITS: Readonly<Record<string, number>> = { COP: 0 };
const DEFAULT_FRACTION_DIGITS = 2;

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function assertCurrency(currency: string): void {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new Error(`Invalid currency "${currency}": expected three uppercase letters, as in COP.`);
  }
}

/**
 * Rejects mixing currencies. Without this, adding COP to USD produces a number
 * that looks fine and means nothing - the exact failure the NOT NULL currency
 * column on `transactions` exists to prevent at the database level.
 */
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot operate on different currencies: ${a.currency} and ${b.currency}.`);
  }
}

export function money(minor: bigint, currency: string): Money {
  assertCurrency(currency);
  return { minor, currency };
}

export function zero(currency: string): Money {
  return money(0n, currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
}

export function negate(a: Money): Money {
  return { minor: -a.minor, currency: a.currency };
}

export function isZero(a: Money): boolean {
  return a.minor === 0n;
}

export function isNegative(a: Money): boolean {
  return a.minor < 0n;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minor < b.minor) return -1;
  if (a.minor > b.minor) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor;
}

export function sum(amounts: readonly Money[], currency: string): Money {
  return amounts.reduce<Money>((acc, item) => add(acc, item), zero(currency));
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Reads what a human types: "45000", "45.000", "$45.000", "1.234.567,89".
 *
 * The hard part is that "." is a thousands separator in Colombia and a decimal
 * point in the US, and the same string can mean either. The rules, in order:
 *
 *  1. If both "." and "," appear, the LAST one is the decimal separator and the
 *     other is grouping. That holds in every locale that uses both.
 *  2. If only one appears more than once, it is grouping - a decimal separator
 *     cannot repeat.
 *  3. If only one appears once, it is grouping when it is followed by exactly
 *     three digits and preceded by at least one digit ("45.000"), and a decimal
 *     separator otherwise ("45.5", ",50").
 *
 * Rule 3 is a genuine ambiguity: "1.234" is one thousand two hundred and
 * thirty-four here, and would be 1.234 in the US. Resolving it toward grouping
 * matches the locale this app is built for, and the caller can always pass an
 * unambiguous string.
 */
export function parseMoney(input: string, currency: string): Money {
  assertCurrency(currency);

  const trimmed = input.trim();
  // The sign can sit before or after the currency symbol ("-$45" and "$-45"),
  // so look for it anywhere ahead of the first digit.
  const firstDigit = trimmed.search(/\d/);
  const beforeDigits = firstDigit === -1 ? trimmed : trimmed.slice(0, firstDigit);
  const negative = beforeDigits.includes('-');
  // Drop currency symbols, codes, spaces - anything that is not a digit or a
  // separator. The sign was already captured.
  const cleaned = trimmed.replace(/[^\d.,]/g, '');

  if (cleaned === '') {
    throw new Error(`Cannot read an amount from "${input}".`);
  }

  const dots = (cleaned.match(/\./g) ?? []).length;
  const commas = (cleaned.match(/,/g) ?? []).length;

  let decimalSeparator: '.' | ',' | null = null;
  if (dots > 0 && commas > 0) {
    decimalSeparator = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') ? '.' : ',';
  } else if (dots === 1 || commas === 1) {
    const separator = dots === 1 ? '.' : ',';
    // slice rather than destructuring split(): the `= ''` defaults that
    // noUncheckedIndexedAccess forces on a destructure are unreachable at
    // runtime, and an unreachable branch can never be covered - which would
    // block the 100% gate this module is held to, permanently.
    const at = cleaned.indexOf(separator);
    const head = cleaned.slice(0, at);
    const tail = cleaned.slice(at + 1);
    const looksLikeGrouping = tail.length === 3 && head.length > 0;
    decimalSeparator = looksLikeGrouping ? null : separator;
  }

  let integerPart: string;
  let fractionPart: string;
  if (decimalSeparator === null) {
    integerPart = cleaned.replace(/[.,]/g, '');
    fractionPart = '';
  } else {
    const cut = cleaned.lastIndexOf(decimalSeparator);
    integerPart = cleaned.slice(0, cut).replace(/[.,]/g, '');
    fractionPart = cleaned.slice(cut + 1).replace(/[.,]/g, '');
  }

  if (fractionPart.length > 2) {
    // Accepting this would silently drop money the user typed.
    throw new Error(
      `"${input}" has more than two decimals; an amount cannot be more precise than a cent.`,
    );
  }
  if (integerPart === '' && fractionPart === '') {
    throw new Error(`Cannot read an amount from "${input}".`);
  }

  const minor =
    BigInt(integerPart === '' ? '0' : integerPart) * SCALE +
    // padEnd on an empty string already yields '00', so no fallback is needed.
    BigInt(fractionPart.padEnd(2, '0'));

  return { minor: negative ? -minor : minor, currency };
}

// ── Formatting ──────────────────────────────────────────────────────────────

/**
 * Builds the exact decimal string for an amount, without ever going through a
 * float. Intl.NumberFormat accepts a string, so precision survives all the way
 * to the rendered characters - a number would round above 2^53.
 */
function toDecimalString(minor: bigint): Intl.StringNumericLiteral {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const units = absolute / SCALE;
  const cents = absolute % SCALE;
  // The cast is unavoidable: TypeScript cannot prove a template built from a
  // bigint matches `${number}`, even though every branch here produces one.
  return `${negative ? '-' : ''}${units}.${cents
    .toString()
    .padStart(2, '0')}` as Intl.StringNumericLiteral;
}

export interface FormatOptions {
  /** Overrides the currency's display digits. COP defaults to 0, others to 2. */
  readonly fractionDigits?: number;
}

/**
 * The locale is required on purpose. A default here would be a hardcoded
 * formatting decision buried in the arithmetic module, and the design system is
 * explicit that the locale decides how money reads.
 */
export function formatMoney(amount: Money, locale: string, options: FormatOptions = {}): string {
  const digits =
    options.fractionDigits ?? DISPLAY_FRACTION_DIGITS[amount.currency] ?? DEFAULT_FRACTION_DIGITS;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toDecimalString(amount.minor));
}
