/**
 * CSV Export Service.
 *
 * Implements RFC 4180 compliant CSV serialization with protection against
 * CSV/Formula injection (OWASP).
 */

import { toDecimalString } from '@/core/money';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';

const CSV_HEADERS = [
  'id',
  'date',
  'merchant',
  'amount',
  'currency',
  'type',
  'category',
  'account',
  'status',
  'source',
  'note',
] as const;

/**
 * Characters that trigger formula execution in spreadsheet software (Excel, LibreOffice).
 * Prepending a single quote neutralizes the formula execution risk.
 */
const FORMULA_TRIGGERS = /^([=+\-@\t\r])/;

export function sanitizeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Neutralize formula injection
  if (FORMULA_TRIGGERS.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: wrap in quotes if it contains commas, double quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an enriched transaction row into a CSV row.
 *
 * The amount goes through core/money's toDecimalString rather than a local
 * copy: an export whose arithmetic drifts from the app's is a spreadsheet that
 * disagrees with the screen, and no one would know which was right.
 *
 * `locale` is a parameter rather than a call to t() with its default, so this
 * service does not quietly pin an API response to one language. Nothing passes
 * it yet - the app has no locale negotiation - but the alternative is a core
 * service that reads the presentation layer's default and cannot be told
 * otherwise, which is the retrofit CLAUDE.md rules out for B5 onwards.
 */
export function formatTransactionToCsvRow(
  tx: EnrichedTransactionRow,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const fields = [
    sanitizeCsvField(tx.id),
    sanitizeCsvField(tx.transactionDate.toISOString().split('T')[0]),
    sanitizeCsvField(tx.merchant),
    toDecimalString(tx.amountMinor),
    sanitizeCsvField(tx.currency),
    sanitizeCsvField(tx.type),
    // Through the catalog, not a Spanish literal: the same two words are
    // already keys, and an export is a document the user keeps.
    sanitizeCsvField(tx.category?.name ?? t('uncategorized', locale)),
    sanitizeCsvField(tx.account?.name ?? t('account_cash', locale)),
    sanitizeCsvField(tx.status),
    sanitizeCsvField(tx.categorizedBy ?? 'manual'),
    sanitizeCsvField(tx.note ?? ''),
  ];

  return fields.join(',');
}

/** A value, not a function: the headers never change between calls. */
export const CSV_HEADER_LINE = `${CSV_HEADERS.join(',')}\r\n`;
