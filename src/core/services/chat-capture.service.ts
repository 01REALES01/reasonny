import { uuidFromSeed } from '@/core/idempotency';
import { parseQuickEntry, type QuickEntryFailure } from '@/core/quick-entry';
import { recordIngestionFailure } from '@/core/repositories/ingestion-failure.repository';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import type {
  TransactionRow,
  TransactionSource,
} from '@/core/repositories/transaction.repository';
import { recordTransaction } from '@/core/services/transaction.service';
import type { UserId } from '@/core/types';

/**
 * A sentence typed in a chat, turned into a row.
 *
 * WHY THE CLIENT DOES NOT DO THIS
 * -------------------------------
 * The Telegram handler could have called `parseQuickEntry` and then
 * `recordTransaction` itself - it is only two calls. But between them sit three
 * decisions that are not the chat's to make: which source the row is filed
 * under, whether a retry is a second spend, and which failures are worth
 * keeping. Put them in the client and the WhatsApp client will answer them
 * differently, and the two surfaces will quietly disagree about what the same
 * sentence means (P9).
 */

export type ChatCaptureResult =
  | {
      readonly ok: true;
      readonly transaction: TransactionRow;
      readonly isDuplicate: boolean;
      readonly autoCategorized: boolean;
      readonly appliedCategory: { readonly name: string; readonly icon: string } | null;
    }
  | { readonly ok: false; readonly reason: QuickEntryFailure | 'unknown_account' | 'unknown_category' };

export interface ChatCaptureOptions {
  readonly source: TransactionSource;
  /**
   * The provider's own id for this message - `telegram:<chat>:<message>`.
   *
   * It is what stops a redelivered update from becoming a second spend, and
   * why it is an EVENT id rather than a hash of the text: two coffees at the
   * same place for the same amount on the same day is a real thing that
   * happens, and hashing the sentence would discard the second one.
   */
  readonly externalId: string;
}

/**
 * Which unparseable messages are worth keeping, and which are just chat.
 *
 * `recordIngestionFailure` feeds a review screen. Filing every "hola" there
 * would bury the one message that actually matters - a real spend the parser
 * could not read - under conversation, which is precisely the noise P2 forbids
 * an alert to fire on.
 *
 * So: anything where an amount WAS found and something else went wrong is
 * evidence. A message with no amount is only evidence if it contains a digit
 * at all; otherwise it was never an attempt to record money.
 */
function isWorthRecording(reason: QuickEntryFailure, text: string): boolean {
  return reason === 'no_amount' ? /\d/.test(text) : true;
}

export async function captureFromText(
  userId: UserId,
  profile: ProfileRow,
  text: string,
  options: ChatCaptureOptions,
): Promise<ChatCaptureResult> {
  const parsed = parseQuickEntry(text, profile.baseCurrency);

  if (!parsed.ok) {
    if (isWorthRecording(parsed.reason, text)) {
      try {
        await recordIngestionFailure(userId, {
          source: options.source,
          rawPayload: { text, externalId: options.externalId },
          error: parsed.reason,
        });
      } catch (error) {
        // The user still gets told what went wrong. Losing the diagnostic is
        // not a reason to also lose the reply.
        console.error('[chat-capture] could not record a failure:', error);
      }
    }
    return { ok: false, reason: parsed.reason };
  }

  const { entry } = parsed;

  const result = await recordTransaction(userId, profile, {
    amountMinor: entry.amountMinor,
    type: entry.type,
    merchant: entry.merchant,
    note: entry.note,
    // When they typed it. A chat message carries no date of its own, and
    // asking for one would undo the entire point of a one-line entry.
    transactionDate: new Date(),
    source: options.source,
    idempotencyKey: uuidFromSeed(options.externalId),
    categoryId: null,
    // No currency override: unlike a bank SMS, which states what it charged,
    // a typed number is in whatever the account speaks.
    location: null,
    // A chat has no GPS. 'manual' is the honest source for a spend written
    // down by hand, and resolveLocation drops the reading anyway.
    locationSource: 'manual',
  });

  if (!result.ok) {
    try {
      await recordIngestionFailure(userId, {
        source: options.source,
        rawPayload: { text, externalId: options.externalId },
        error: result.reason,
      });
    } catch (error) {
      console.error('[chat-capture] could not record a failure:', error);
    }
    return result;
  }

  return {
    ok: true,
    transaction: result.transaction,
    isDuplicate: result.isDuplicate,
    autoCategorized: result.autoCategorized,
    appliedCategory: result.appliedCategory,
  };
}
