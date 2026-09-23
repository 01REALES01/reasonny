import { parseMoney } from '@/core/money';

/**
 * Reading a spend out of a sentence somebody typed.
 *
 * `12000 juan valdez` is the whole interface for cash, and cash is the hole in
 * this app: a card fires an SMS, a QR and a bill in a pocket fire nothing. The
 * cost of writing one down has to be one line in a chat the user already has
 * open, or it does not get written down at all.
 *
 * Pure, like money.ts and categorization.ts. No database, no network, and no
 * model - which matters more than it looks: an LLM asked to read "12000 juan
 * valdez" will answer confidently on the day it misreads the amount, and this
 * is the number that ends up in the ledger. A regex that refuses is safe; a
 * guess that is wrong is not.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * No dates ("ayer"), no currencies other than the profile's, no categories, no
 * multiple spends in one line. Every one of those is a guess about intent, and
 * the doctrine here - the SMS parsers, the amount reader - is that a wrong
 * answer costs more than no answer. When it cannot read something it says so
 * and the user retypes; it never files an approximation.
 */

export interface QuickEntry {
  readonly amountMinor: bigint;
  readonly type: 'expense' | 'income';
  readonly merchant: string;
  readonly note: string | null;
}

export type QuickEntryFailure =
  /** Nothing in the line looks like an amount. Probably not a spend at all. */
  | 'no_amount'
  /** An amount and nothing to call it. "12000" alone says nothing in a month's time. */
  | 'no_merchant'
  /** Zero, or a negative that survived. Neither is a transaction. */
  | 'not_positive';

export type QuickEntryResult =
  | { readonly ok: true; readonly entry: QuickEntry }
  | { readonly ok: false; readonly reason: QuickEntryFailure };

/** The column is varchar(255); truncating here keeps the write path honest. */
const MAX_MERCHANT = 255;
const MAX_NOTE = 1000;

/**
 * Only the first and last word are considered as the amount.
 *
 * Scanning every token would find the 7 in "carrera 7" and the 24 in "tienda
 * 24". People write the amount at one end of the line or the other, and a rule
 * you can state in one sentence is one the user can predict - which matters far
 * more here than catching an extra phrasing.
 */
const AMOUNT_TOKEN = /^[+-]?\$?\d[\d.,]*$/;

/** A merchant has to be something you could recognise later. "15000" is not. */
const HAS_A_LETTER = /\p{L}/u;

/**
 * Splits off a trailing note.
 *
 * The dash has to be surrounded by spaces, so "7-11" and "coca-cola" stay in
 * the merchant where they belong.
 */
function splitNote(text: string): { head: string; note: string | null } {
  // `(?:\s+|$)` and not just `\s+`: the input is trimmed before it gets here,
  // so "12000 tienda - " arrives as "12000 tienda -" and a dash that ends the
  // line would otherwise be glued onto the merchant name.
  const match = /\s+[-—](?:\s+|$)/.exec(text);
  if (!match) {
    return { head: text, note: null };
  }
  const note = text.slice(match.index + match[0].length).trim();
  return {
    head: text.slice(0, match.index).trim(),
    note: note ? note.slice(0, MAX_NOTE) : null,
  };
}

export function parseQuickEntry(input: string, currency: string): QuickEntryResult {
  const { head, note } = splitNote(input.trim());
  const words = head.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    // One word is either a bare amount or a bare name; neither is a spend.
    return { ok: false, reason: words.length === 1 && AMOUNT_TOKEN.test(words[0] as string) ? 'no_merchant' : 'no_amount' };
  }

  const first = words[0] as string;
  const last = words[words.length - 1] as string;

  const amountIsFirst = AMOUNT_TOKEN.test(first);
  const rawAmount = amountIsFirst ? first : AMOUNT_TOKEN.test(last) ? last : null;

  if (rawAmount === null) {
    return { ok: false, reason: 'no_amount' };
  }

  let minor: bigint;
  try {
    minor = parseMoney(rawAmount, currency).minor;
  } catch {
    // parseMoney refuses more than two decimals, among other things. Its
    // refusals are deliberate and are not overridden here.
    return { ok: false, reason: 'no_amount' };
  }

  if (minor === 0n) {
    return { ok: false, reason: 'not_positive' };
  }

  const merchant = (amountIsFirst ? words.slice(1) : words.slice(0, -1)).join(' ');
  if (!HAS_A_LETTER.test(merchant)) {
    return { ok: false, reason: 'no_merchant' };
  }

  return {
    ok: true,
    entry: {
      // A leading '+' is the only way to say "this came in". Everything else is
      // a spend, because almost everything is - and making the common case the
      // default is what keeps this to one line.
      type: rawAmount.startsWith('+') ? 'income' : 'expense',
      // Absolute: a leading '-' is someone spelling out that it is an expense,
      // not asking for a negative row. The column forbids one anyway.
      amountMinor: minor < 0n ? -minor : minor,
      merchant: merchant.slice(0, MAX_MERCHANT),
      note,
    },
  };
}
