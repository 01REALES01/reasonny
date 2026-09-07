import { bancoBogotaParser } from './banco-bogota';
import { bancolombiaParser } from './bancolombia';
import type { ParsedSms, SmsParser } from './types';

export type { ParsedSms, SmsParser } from './types';

/**
 * Strategy registry, one entry per bank.
 *
 * A new bank is a new file and a line here; no existing parser is touched, so
 * adding Davivienda cannot break Bancolombia. Order does not matter because
 * `matches` keys on the bank's own name in the message.
 */
const PARSERS: readonly SmsParser[] = [bancolombiaParser, bancoBogotaParser];

export type SmsParseFailure =
  | 'unknown_bank'
  | 'unrecognized_format'
  | 'declined';

export type SmsParseResult =
  | { readonly ok: true; readonly transaction: ParsedSms }
  | { readonly ok: false; readonly reason: SmsParseFailure; readonly bank: string | null };

/**
 * Turns a bank SMS into a transaction, or explains why it could not.
 *
 * Never throws and never guesses. Every failure names a reason, because the
 * message that could not be read is the one that tells you which format
 * changed - and banks change them without notice. The caller stores the raw
 * text so the spend reaches the review inbox instead of disappearing.
 *
 * A declined purchase is a successful parse of a transaction that must not be
 * recorded, which is why it is its own reason rather than an error.
 */
export function parseBankSms(text: string): SmsParseResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'unknown_bank', bank: null };
  }

  const parser = PARSERS.find((p) => p.matches(trimmed));
  if (!parser) {
    return { ok: false, reason: 'unknown_bank', bank: null };
  }

  const parsed = parser.parse(trimmed);
  if (!parsed) {
    return { ok: false, reason: 'unrecognized_format', bank: parser.bank };
  }

  if (parsed.declined) {
    return { ok: false, reason: 'declined', bank: parser.bank };
  }

  return { ok: true, transaction: parsed };
}
