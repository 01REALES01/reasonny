import React from 'react';

import { formatMoney } from '@/core/money';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

interface MoneyProps {
  readonly amountMinor: bigint;
  readonly currency?: string;
  readonly locale?: Locale;
  readonly showFractionDeEmphasis?: boolean;
}

/**
 * Splits a formatted currency string into the prominent integer part
 * and the de-emphasized cents according to DESIGN_SYSTEM.md 3.3.
 *
 * COP has no cents on screen, so nothing matches and the amount renders whole.
 * It used to shrink the last three digits instead, and "$ 45.000" read as
 * "$ 45" - in a currency where the thousands ARE the amount.
 */
function splitMoneyParts(formatted: string): { integerPart: string; fractionPart: string } {
  // e.g. "$ 1,847.50" -> integer "$ 1,847", fraction ".50"
  const match = formatted.match(/^(.*)([.,]\d{2})$/);
  if (match && match[1] && match[2]) {
    return {
      integerPart: match[1],
      fractionPart: match[2],
    };
  }

  return { integerPart: formatted, fractionPart: '' };
}

/**
 * The ONLY component authorized to render money in the UI.
 *
 * Enforces tabular numbers (tnum) and decimal/thousand de-emphasis to preserve
 * layout stability and visual hierarchy.
 */
export function Money({
  amountMinor,
  currency = 'COP',
  locale = DEFAULT_LOCALE,
  showFractionDeEmphasis = true,
}: MoneyProps): React.ReactElement {
  const localeTag = locale === 'es' ? 'es-CO' : 'en-US';
  const formatted = formatMoney({ minor: amountMinor, currency }, localeTag);

  const { integerPart, fractionPart } = showFractionDeEmphasis
    ? splitMoneyParts(formatted)
    : { integerPart: formatted, fractionPart: '' };

  if (!fractionPart) {
    return <span className="money">{formatted}</span>;
  }

  return (
    <span className="money">
      {integerPart}
      <span className="money__fraction">{fractionPart}</span>
    </span>
  );
}
