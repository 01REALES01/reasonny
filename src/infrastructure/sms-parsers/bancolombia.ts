import {
  cleanCounterparty,
  extractAccountMask,
  extractAmountMinor,
  extractTransactionDate,
  isDeclined,
} from './shared';
import type { ParsedSms, SmsParser } from './types';

/**
 * Bancolombia.
 *
 * Four templates observed, and the direction is carried by the verb rather than
 * by any structural difference: "Recibiste" is money in, "transferiste" and
 * "pagaste" are money out. The verb is checked before anything else because
 * getting the sign wrong turns income into a spend, which is the one error that
 * corrupts every total on the dashboard at once.
 */

const INCOME_VERB = /\bRecibiste\b/i;
const EXPENSE_VERB = /\b(transferiste|pagaste|compraste|retiraste)\b/i;

/** "de IGNIA SAS a tu cuenta" · "de LUIS SILVA en tu cuenta" */
const INCOMING_FROM = /\bde\s+(.+?)\s+(?:a|en)\s+tu\s+cuenta/i;

/**
 * "a <nombre> el 07/09/26" - the name sits between the account and the date.
 *
 * The lookahead is load-bearing. A QR payment has the same shape but ends in
 * "a la llave 3000000001", so without it the pattern captured the key and the
 * merchant became somebody's phone number - written into the database, shown on
 * the dashboard, and carried into the CSV export.
 */
const OUTGOING_TO_NAME = /\bcuenta\s+\*{1,2}\d{4}\s+a\s+(?!la\s+llave\b)(.+?)\s+el\s+\d{2}\//i;

/** "a la llave 3107568746" - a QR or Bre-b payment with no name attached. */
const OUTGOING_TO_KEY = /\bllave\s+(\d{6,})/i;

export const bancolombiaParser: SmsParser = {
  bank: 'bancolombia',

  matches(text: string): boolean {
    return /bancolombia/i.test(text);
  },

  parse(text: string): ParsedSms | null {
    const isIncome = INCOME_VERB.test(text);
    const isExpense = EXPENSE_VERB.test(text);

    // Neither or both means the template changed. Returning null sends the
    // message to the review inbox with its raw text, which is recoverable;
    // picking a direction by default is not.
    if (isIncome === isExpense) {
      return null;
    }

    const amountMinor = extractAmountMinor(text, 'COP');
    const transactionDate = extractTransactionDate(text);
    if (amountMinor === null || amountMinor <= 0n || !transactionDate) {
      return null;
    }

    let merchant: string;
    if (isIncome) {
      const from = INCOMING_FROM.exec(text)?.[1];
      merchant = from ? cleanCounterparty(from) : 'Transferencia recibida';
    } else {
      const name = OUTGOING_TO_NAME.exec(text)?.[1];
      const key = OUTGOING_TO_KEY.exec(text)?.[1];
      // A name when the message carries one; otherwise the key, masked. The
      // full number is somebody's phone, and it is not needed to recognise the
      // payment later.
      merchant = name
        ? cleanCounterparty(name)
        : key
          ? `Llave ••${key.slice(-4)}`
          : 'Transferencia enviada';
    }

    if (merchant === '') {
      return null;
    }

    return {
      bank: 'bancolombia',
      amountMinor,
      currency: 'COP',
      type: isIncome ? 'income' : 'expense',
      merchant,
      transactionDate,
      accountMask: extractAccountMask(text),
      declined: isDeclined(text),
    };
  },
};
