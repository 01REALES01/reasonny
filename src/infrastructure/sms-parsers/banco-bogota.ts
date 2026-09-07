import {
  cleanCounterparty,
  extractAccountMask,
  extractAmountMinor,
  extractTransactionDate,
  isDeclined,
} from './shared';
import type { ParsedSms, SmsParser } from './types';

/**
 * Banco de Bogotá.
 *
 * One template observed so far, and a stricter one than Bancolombia's: the
 * merchant is whatever follows " en " up to the closing marketing sentence.
 *
 * Note that "fue aprobada" is not treated as proof of approval - isDeclined
 * looks for the rejection wording instead. The bank sends the same sentence
 * shape for both outcomes and only the verb changes, so testing for the
 * negative is what stops a rejected purchase being filed as a spend.
 */

const MERCHANT = /\ben\s+([A-Z0-9ÁÉÍÓÚÑ][^¿?]*)/;

export const bancoBogotaParser: SmsParser = {
  bank: 'banco_bogota',

  matches(text: string): boolean {
    return /banco\s+de\s+bogot/i.test(text);
  },

  parse(text: string): ParsedSms | null {
    const amountMinor = extractAmountMinor(text, 'COP');
    const transactionDate = extractTransactionDate(text);
    if (amountMinor === null || amountMinor <= 0n || !transactionDate) {
      return null;
    }

    const rawMerchant = MERCHANT.exec(text)?.[1];
    const merchant = rawMerchant ? cleanCounterparty(rawMerchant) : '';
    if (merchant === '') {
      return null;
    }

    // Only purchases have been observed. An incoming template will not match
    // the merchant rule and will land in the review inbox rather than be
    // recorded with the wrong sign.
    return {
      bank: 'banco_bogota',
      amountMinor,
      currency: 'COP',
      type: 'expense',
      merchant,
      transactionDate,
      accountMask: extractAccountMask(text),
      declined: isDeclined(text),
    };
  },
};
