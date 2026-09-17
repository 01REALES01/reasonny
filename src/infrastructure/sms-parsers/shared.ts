/**
 * The parts every Colombian bank SMS has in common.
 *
 * Six real messages from two banks turned out to be one grammar with cosmetic
 * differences, so the amount, the date and the time are extracted once here and
 * only the counterparty needs a per-bank rule.
 *
 * On node-re2: CLAUDE.md requires it for regexes that come from a user, because
 * a pattern someone else wrote can be crafted to backtrack forever. These
 * patterns are ours and fixed; what is untrusted is the input. None of them
 * nests a quantifier inside another, so each runs in linear time on any input,
 * adversarial or not.
 */
import { parseMoney } from '@/core/money';

/**
 * Colombia does not observe daylight saving and has not since 1993, so the
 * offset is a constant rather than a timezone lookup. A bank SMS carries a
 * local wall-clock time with no offset in it; without this the timestamp would
 * be read as UTC and every evening transaction would land on the next day.
 */
const BOGOTA_UTC_OFFSET_HOURS = 5;

/**
 * The digits of an amount, grouping separator included, for parseMoney to read.
 *
 * TWO PATTERNS, NOT ONE, AND NEITHER IS OPTIONAL-DOLLAR
 * ----------------------------------------------------
 * The single pattern this replaces made the `$` optional, so in a message that
 * names the card before the amount it matched the card: "Tarjeta 1111 por
 * $45,000" captured "111" and the ledger recorded eleven pesos ten. Requiring
 * the symbol fixes that, but Banco de Bogotá writes "Tu compra por 45,000" with
 * no symbol at all - hence the second pattern, anchored on the word both banks
 * use to introduce the figure. A message with neither yields null and goes to
 * the review queue as an unreadable format, which is the correct answer: this
 * parser does not guess amounts.
 *
 * BOTH SEPARATORS GROUP
 * ---------------------
 * The old pattern accepted only the comma. Colombia writes thousands with a
 * dot at least as often, and "$45.000" fell into the DECIMAL branch: it
 * captured "45.00" and stored forty-five pesos for a forty-five thousand peso
 * purchase. A thousandfold undercount, silent, in a money app. Which separator
 * is decimal and which is grouping is parseMoney's job - it already resolves it
 * by position and group length - so the pattern's only duty is to hand over the
 * whole number instead of half of it.
 *
 * `$45.000` · `$1.000.000` · `20,900` · `$1,000,000.00` · `$4,000.00`
 */
const AMOUNT_DIGITS = '\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?';
const AMOUNT_WITH_SYMBOL = new RegExp(`\\$\\s?(${AMOUNT_DIGITS})`);
const AMOUNT_AFTER_POR = new RegExp(`\\bpor\\s+(${AMOUNT_DIGITS})`, 'i');

/** `26/08/26` and `25/08/2026` both appear, from the same bank. */
const DATE = /(\d{2})\/(\d{2})\/(\d{2}(?:\d{2})?)/;

/** `20:18:00` and `13:15` both appear, from the same bank. */
const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** `*1724` · `**1724` · `Tarjeta Débito 0655` · `T.Deb *5381` · `T.Cred *1234` */
const ACCOUNT_MASK =
  /\*{1,2}(\d{4})|(?:(?:Tarjeta\s+[A-Za-zÁ-ú]+|T\.(?:Deb|Cred))\s+\*?)(\d{4})/i;

export function extractAmountMinor(
  text: string,
  currency: string,
): bigint | null {
  // Symbol first: when a message has both a "$" figure and a "por" figure they
  // are the same number, and the symbol is the less ambiguous anchor.
  const match = AMOUNT_WITH_SYMBOL.exec(text) ?? AMOUNT_AFTER_POR.exec(text);
  if (!match?.[1]) {
    return null;
  }

  try {
    // parseMoney rather than a hand-rolled Number(): it already resolves the
    // comma-vs-dot ambiguity the way this locale writes it, and it is the only
    // module allowed to turn text into an amount.
    return parseMoney(match[1], currency).minor;
  } catch {
    return null;
  }
}

/**
 * Reads the timestamp without depending on the order of its parts.
 *
 * That is not defensive style, it is required: Bancolombia's incoming-payment
 * template says "el 12:24 a las 25/08/2026" - time where the date belongs and
 * date where the time belongs - while its other templates say the opposite. A
 * parser that reads them positionally builds an invalid date and does it
 * silently. Slashes mean a date and colons mean a time in every message
 * observed, so each is found by its own shape.
 */
export function extractTransactionDate(text: string): Date | null {
  const dateMatch = DATE.exec(text);
  if (!dateMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const rawYear = dateMatch[3]!;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  // Search for the time outside the date's own span, or `26/08/26 20:18` would
  // be free to match digits belonging to the date.
  const withoutDate =
    text.slice(0, dateMatch.index) + ' ' + text.slice(dateMatch.index + dateMatch[0].length);
  const timeMatch = TIME.exec(withoutDate);

  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;
  const seconds = timeMatch?.[3] ? Number(timeMatch[3]) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
    return null;
  }

  const date = new Date(
    Date.UTC(year, month - 1, day, hours + BOGOTA_UTC_OFFSET_HOURS, minutes, seconds),
  );

  // Date.UTC rolls an impossible day forward instead of failing, so 31/02 would
  // come back as 3 March rather than as an error. Reading the day back is what
  // catches it.
  const localDay = new Date(date.getTime() - BOGOTA_UTC_OFFSET_HOURS * 3600_000);
  if (localDay.getUTCDate() !== day || localDay.getUTCMonth() !== month - 1) {
    return null;
  }

  return date;
}

export function extractAccountMask(text: string): string | null {
  const match = ACCOUNT_MASK.exec(text);
  return match?.[1] ?? match?.[2] ?? null;
}

/**
 * Trims the trailing sentence banks append to every message ("¿Dudas? Llama a
 * la Servilinea", "Con Bre-b es de una y gratis") plus stray punctuation, so
 * the merchant does not arrive with marketing copy attached.
 */
export function cleanCounterparty(raw: string): string {
  return raw
    .split(/\s*(?:¿|\?|\.(?:\s+|$)|,(?:\s+|$)|Con\s+|Si\s+tienes|Dudas|Estamos|Siempre)/u)[0]!
    .replace(/[.,\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A message that reports a rejection must never be counted as a spend. */
export function isDeclined(text: string): boolean {
  return /\b(rechazad|declinad|no fue aprobad|negad)/i.test(text);
}
