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

/**
 * Purchases at a store, POS, or digital merchant:
 * "Compraste $38.450,00 en BAR GENERICO CENTRO con tu T.Deb *1111, el 17/09/2026..."
 * "Compraste $11.200,00 en APP*VIAJES con tu T.Deb *2222, el 17/09/2026..."
 * "Pagaste $15,000.00 en RESTAURANTE con tu T.Deb *1234, el 17/09/2026..."
 * "Compraste $50,000 en EXITO el 17/09/2026..."
 */
const PURCHASE_MERCHANT =
  /\b(?:compraste|pagaste)\b.+?\ben\s+(?!tu\s+cuenta\b)(.+?)(?:\s*,?\s*con\s+tu\b|\s*,?\s*el\s+\d{2}\/|\s*\.)/i;

/** "de IGNIA SAS a tu cuenta" · "de LUIS SILVA en tu cuenta" */
const INCOMING_FROM = /\bde\s+(.+?)\s+(?:a|en)\s+tu\s+cuenta/i;

/**
 * "a <nombre> el 07/09/26" - the name sits between the account and the date.
 *
 * The lookahead excludes both "la llave" (QR/Bre-b key) and "la cuenta"
 * (transfers to an account number), so neither phone numbers nor account numbers
 * become the merchant name in the database.
 */
const OUTGOING_TO_NAME =
  /\bcuenta\s+\*{1,2}\d{4}\s+a\s+(?!la\s+(?:llave|cuenta)\b)(.+?)\s+el\s+\d{2}\//i;

/** "a la cuenta *3000000002" - a transfer to an account with no recipient name */
const OUTGOING_TO_ACCOUNT = /\ba\s+la\s+cuenta\s+\*{0,2}(\d+)/i;

/** "a la llave 3107568746" - a QR or Bre-b payment with no name attached. */
const OUTGOING_TO_KEY = /\bllave\s+(\d{6,})/i;

/** "Retiraste $50,000 de tu cuenta *1234 en CAJERO..." */
const WITHDRAWAL_AT = /\bretiraste\b.+?\ben\s+(.+?)(?:\s*,?\s*el\s+\d{2}\/|\s*\.)/i;

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
      const purchase = PURCHASE_MERCHANT.exec(text)?.[1];
      const name = OUTGOING_TO_NAME.exec(text)?.[1];
      const toAccount = OUTGOING_TO_ACCOUNT.exec(text)?.[1];
      const key = OUTGOING_TO_KEY.exec(text)?.[1];
      const withdrawal = WITHDRAWAL_AT.exec(text)?.[1];
      const isWithdrawal = /\bretiraste\b/i.test(text);

      // Prioritize the actual merchant where money was spent. When none exists:
      // a named person if the message carried one; otherwise the account/key
      // masked so private phones/account numbers do not populate the merchant
      // column.
      merchant = purchase
        ? cleanCounterparty(purchase)
        : name
          ? cleanCounterparty(name)
          : toAccount
            ? `Cuenta ••${toAccount.slice(-4)}`
            : key
              ? `Llave ••${key.slice(-4)}`
              : withdrawal
                ? cleanCounterparty(withdrawal)
                : isWithdrawal
                  ? 'Retiro en cajero'
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
