import React from 'react';

import { formatMoney } from '@/core/money';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

export interface MoneyProps {
  readonly amountMinor: bigint;
  readonly currency?: string;
  readonly locale?: Locale;
  readonly className?: string;
  readonly size?: 'hero' | 'display' | 'title' | 'heading' | 'body' | 'caption';
  readonly showFractionDeEmphasis?: boolean;
}

/**
 * Splits a formatted currency string into the prominent integer part
 * and the de-emphasized fraction/thousand part according to DESIGN_SYSTEM.md 3.3.
 */
function splitMoneyParts(
  formatted: string,
  currency: string,
): { integerPart: string; fractionPart: string } {
  if (currency === 'COP') {
    // For COP without cents: if amount is >= 10,000, de-emphasize the last 3 digits
    // e.g. "$ 1.847.300" -> integer "$ 1.847", fraction ".300"
    // Find the last separator (. or ,) before the final 3 digits
    const match = formatted.match(/^(.*)([.,]\d{3})$/);
    if (match && match[1] && match[2]) {
      return {
        integerPart: match[1],
        fractionPart: match[2],
      };
    }
    return { integerPart: formatted, fractionPart: '' };
  }

  // Standard currencies with cents (USD, EUR)
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
  className = '',
  size,
  showFractionDeEmphasis = true,
}: MoneyProps): React.ReactElement {
  const localeTag = locale === 'es' ? 'es-CO' : 'en-US';
  const formatted = formatMoney({ minor: amountMinor, currency }, localeTag);

  const sizeClass = size ? `money--${size}` : '';

  if (!showFractionDeEmphasis) {
    return <span className={`money ${sizeClass} ${className}`.trim()}>{formatted}</span>;
  }

  const { integerPart, fractionPart } = splitMoneyParts(formatted, currency);

  if (!fractionPart) {
    return <span className={`money ${sizeClass} ${className}`.trim()}>{formatted}</span>;
  }

  return (
    <span className={`money ${sizeClass} ${className}`.trim()}>
      <span className="money__integer">{integerPart}</span>
      <span className="money__fraction">{fractionPart}</span>
    </span>
  );
}
