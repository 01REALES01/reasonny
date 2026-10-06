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

/** How each bank is written for a person; the parser id reads as a code. */
const BANK_LABELS: Readonly<Record<string, string>> = {
  bancolombia: 'Bancolombia',
  banco_bogota: 'Banco de Bogotá',
};

export function bankLabel(bank: string): string {
  return BANK_LABELS[bank] ?? bank;
}

/**
 * Credit only when the message says so. A debit card in Colombia draws on a
 * savings account, and that is what every other template describes.
 */
export function accountTypeFromSms(text: string): 'credit_card' | 'savings' {
  return /T\.\s*Cred|Tarjeta\s+Cr[eé]dito/i.test(text) ? 'credit_card' : 'savings';
}

/** Stands in for the digits of a credit card whose message names none. */
const CREDIT_WITHOUT_DIGITS = 'TC';

export interface SmsBankAccount {
  readonly bank: string;
  /** '' for the bank's deposit account; the card's digits for a credit card. */
  readonly mask: string;
  /** The account's name as the person reads it: "Bancolombia", "Bancolombia Crédito *1234". */
  readonly label: string;
  readonly type: 'credit_card' | 'savings';
}

/**
 * Which account a bank message belongs to.
 *
 * One deposit account per bank, whatever digits the message carries. The same
 * savings account shows up under several numbers: purchases name the debit
 * card ("T.Deb *1111"), and a second card or a virtual one has its own digits;
 * transfers and QR payments name the account ("cuenta *9999"); some incoming
 * payments name none. Keying on those digits split one account into three.
 * A message cannot say which card draws on which account, so a person with two
 * savings accounts at one bank sees them together - the lesser error.
 *
 * A credit card is different money, with its own limit and statement, so each
 * one keeps its own account by its digits.
 */
export function bankAccountFromSms(parsed: ParsedSms, text: string): SmsBankAccount {
  const label = bankLabel(parsed.bank);
  if (accountTypeFromSms(text) === 'credit_card') {
    return {
      bank: parsed.bank,
      // Never '': that key belongs to the deposit account.
      mask: parsed.accountMask ?? CREDIT_WITHOUT_DIGITS,
      label: parsed.accountMask ? `${label} Crédito *${parsed.accountMask}` : `${label} Crédito`,
      type: 'credit_card',
    };
  }
  return { bank: parsed.bank, mask: '', label, type: 'savings' };
}
