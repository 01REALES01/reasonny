/**
 * Bank SMS parsing.
 *
 * Every Colombian bank writes the same six facts in a slightly different
 * sentence, so the shape below is what all of them reduce to. A parser either
 * produces one of these or returns null - it never guesses, because a guessed
 * amount is worse than no transaction at all: the user would have to notice the
 * error to correct it, and nobody audits a number that looks plausible.
 */
export interface ParsedSms {
  /** Which strategy matched. Kept for telemetry and for finding the format that broke. */
  readonly bank: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly type: 'expense' | 'income';
  /** Merchant, or the counterparty of a transfer. */
  readonly merchant: string;
  readonly transactionDate: Date;
  /** Last digits of the card or account, when the message carries them. */
  readonly accountMask: string | null;
  /** Whether the message says the transaction was rejected. */
  readonly declined: boolean;
}

export interface SmsParser {
  readonly bank: string;
  /** Cheap test before the expensive one, so a message only runs its own bank's rules. */
  matches(text: string): boolean;
  parse(text: string): ParsedSms | null;
}
