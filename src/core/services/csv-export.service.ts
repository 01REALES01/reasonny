/**
 * CSV Export Service.
 *
 * Implements RFC 4180 compliant CSV serialization with protection against
 * CSV/Formula injection (OWASP).
 */

import { SCALE } from '@/core/money';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';

export const CSV_HEADERS = [
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
 * Converts minor units (BIGINT scale 100) to standard decimal notation without float precision loss.
 */
export function minorUnitsToDecimalString(minor: bigint): string {
  const isNegative = minor < 0n;
  const abs = isNegative ? -minor : minor;
  const whole = abs / SCALE;
  const cents = abs % SCALE;

  return `${isNegative ? '-' : ''}${whole}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Formats an enriched transaction row into a CSV row.
 */
export function formatTransactionToCsvRow(tx: EnrichedTransactionRow): string {
  const fields = [
    sanitizeCsvField(tx.id),
    sanitizeCsvField(tx.transactionDate.toISOString().split('T')[0]),
    sanitizeCsvField(tx.merchant),
    minorUnitsToDecimalString(tx.amountMinor),
    sanitizeCsvField(tx.currency),
    sanitizeCsvField(tx.type),
    sanitizeCsvField(tx.category?.name ?? 'Sin categorizar'),
    sanitizeCsvField(tx.account?.name ?? 'Efectivo'),
    sanitizeCsvField(tx.status),
    sanitizeCsvField(tx.categorizedBy ?? 'manual'),
    sanitizeCsvField(tx.note ?? ''),
  ];

  return fields.join(',');
}

/**
 * Generates the full CSV header line.
 */
export function getCsvHeaderLine(): string {
  return `${CSV_HEADERS.join(',')}\r\n`;
}
