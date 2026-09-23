import {
  listCategories,
  listMostUsedCategories,
  type CategoryRow,
  type CategoryType,
} from '@/core/repositories/category.repository';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import {
  findPromptByMessage,
  markPromptAnswered,
  recordPrompt,
  type NotificationProvider,
  type NotificationPromptKind,
} from '@/core/repositories/notification-prompt.repository';
import {
  getEnrichedTransaction,
  type EnrichedTransactionRow,
  type TransactionRow,
} from '@/core/repositories/transaction.repository';
import { categorizeTransaction } from '@/core/services/categorization.service';
import { createUserCategory } from '@/core/services/category.service';
import type { UserId } from '@/core/types';

/**
 * Asking the user a question, without knowing who delivers it.
 *
 * WHY THIS LAYER EXISTS BEFORE THERE IS A SECOND PROVIDER
 * -------------------------------------------------------
 * WhatsApp is in the plan with a written criterion, not a hunch, and the point
 * of building against it now is that the move becomes configuration instead of
 * a rewrite. The shape that makes that true is this one: this file knows about
 * a person, a spend and a set of choices; it does not know about chats, bots,
 * or buttons. An adapter does.
 *
 * It is worth being precise about what does and does not port, because the
 * project docs were optimistic on this. From 1 October 2026 WhatsApp bills
 * free-form replies inside the 24-hour customer service window, with 1,000 free
 * per number per month - so a question the USER starts is portable and, at
 * personal volume, free. A message the app starts on its own - which is exactly
 * the category prompt below - still needs a pre-approved template there. The
 * interface survives the move; the per-transaction prompt is the piece that
 * would have to change shape.
 */

/** What a client needs to draw the question. No mention of any provider. */
export interface CategoryPrompt {
  readonly transaction: TransactionRow;
  /** The handful worth putting up front. */
  readonly suggested: readonly CategoryRow[];
  readonly currency: string;
}

/**
 * The adapter contract.
 *
 * `deliverCategoryPrompt` returns the id the provider gave the message, which
 * is what lets a tapped button be traced back to a transaction - see
 * notification-prompt.repository.ts. `null` means it could not be delivered,
 * which is a fact to record, not an exception to throw: the spend is already
 * saved, and losing the question is far better than losing the money (rule 7).
 */
export interface MessagingAdapter {
  readonly provider: NotificationProvider;
  /**
   * No locale parameter: the adapter is built by the client, which already
   * knows which language this conversation is in - Telegram carries it on
   * every update. Threading it through here would make this file care about a
   * translation catalogue in order to hand it straight back out again.
   */
  deliverCategoryPrompt(
    chatId: bigint,
    prompt: CategoryPrompt,
  ): Promise<{ messageId: bigint } | null>;
}

/** Three is what a phone shows before it starts hiding buttons. */
const SUGGESTED_COUNT = 3;

export type NotifyResult =
  | { readonly sent: true; readonly messageId: bigint }
  | {
      readonly sent: false;
      readonly reason:
        | 'not_linked'
        | 'already_categorized'
        /**
         * Nothing to offer. Separate from 'delivery_failed' because it is the
         * only one of these the user can DO something about, and the caller
         * has to word it differently: a network failure is our problem, an
         * empty category list is a trip to the app.
         */
        | 'no_categories'
        | 'delivery_failed';
    };

/**
 * Asks which category a spend belongs to, if asking is warranted.
 *
 * Called AFTER the transaction is stored, never before (rule 7): a spend with
 * no label is an inconvenience, a spend that was never written down is gone.
 *
 * The caller decides when to run it, because the two callers have different
 * constraints - the SMS endpoint schedules it after its response, since the
 * Shortcut times out at 30 seconds and must not wait on a bot API, while the
 * chat client is already in the conversation and just awaits it.
 */
export async function notifyIfUncategorized(
  userId: UserId,
  profile: ProfileRow,
  transaction: TransactionRow,
  adapter: MessagingAdapter,
): Promise<NotifyResult> {
  if (transaction.categoryId !== null) {
    // The rule engine answered, or the user did. Level 1 is silence.
    return { sent: false, reason: 'already_categorized' };
  }

  const chatId = profile.telegramChatId;
  if (chatId === null) {
    return { sent: false, reason: 'not_linked' };
  }

  // A transfer has no direction to file, so it gets the expense list rather
  // than nothing - the user can still say what it was.
  const type = transaction.type === 'income' ? 'income' : 'expense';
  const suggested = await listMostUsedCategories(userId, type, SUGGESTED_COUNT);
  if (suggested.length === 0) {
    // A question with no buttons under it is a dead end. Checked here and not
    // in the adapter so every provider inherits the same refusal.
    return { sent: false, reason: 'no_categories' };
  }

  const delivered = await adapter.deliverCategoryPrompt(chatId, {
    transaction,
    suggested,
    currency: transaction.currency,
  });

  if (!delivered) {
    return { sent: false, reason: 'delivery_failed' };
  }

  await recordPrompt(userId, {
    transactionId: transaction.id,
    provider: adapter.provider,
    kind: 'category_pick',
    chatId,
    externalMessageId: delivered.messageId,
  });

  return { sent: true, messageId: delivered.messageId };
}


// ── Answering a prompt ──────────────────────────────────────────────────────
//
// Everything below is the other half of the conversation: the user taps, and
// the tap has to be turned back into a transaction. It lives here rather than
// in the Telegram client for the same reason the sending half does - the
// tapping is provider-shaped, the resolving is not - and because a client that
// could resolve a transaction id would be a client that could be told which
// one to resolve.

/**
 * A direction of money is what decides which categories are on offer. A
 * transfer has none, so it is shown the expense list: the user can still say
 * what it was, and an empty keyboard is a dead end.
 */
function categoryTypeFor(transaction: EnrichedTransactionRow): CategoryType {
  return transaction.type === 'income' ? 'income' : 'expense';
}

export interface PromptContext {
  readonly promptId: string;
  /**
   * Which question this was. The caller must branch on it: a reply to the
   * keyboard message is not a category name, it is somebody typing their next
   * spend in the wrong place.
   */
  readonly kind: NotificationPromptKind;
  readonly transaction: EnrichedTransactionRow;
}

/**
 * What a tapped button was attached to.
 *
 * Two lookups and no shortcuts: the message identifies the prompt, the prompt
 * names the transaction, and the transaction is re-read scoped by userId. A
 * callback can be posted by anyone who guesses a message id, so nothing here
 * takes the client's word for which row is being edited (PROJECT_SPEC §3.5).
 *
 * null covers every way this can go wrong at once - a message we never sent, a
 * prompt for a spend since deleted, a chat rebound to another account - and
 * they all deserve the same answer on screen: this is gone, use the app.
 */
export async function resolvePromptContext(
  userId: UserId,
  provider: NotificationProvider,
  chatId: bigint,
  externalMessageId: bigint,
): Promise<PromptContext | null> {
  const prompt = await findPromptByMessage(userId, provider, chatId, externalMessageId);
  if (!prompt) {
    return null;
  }

  const transaction = await getEnrichedTransaction(userId, prompt.transactionId);
  if (!transaction) {
    return null;
  }

  return {
    promptId: prompt.id,
    kind: prompt.kind as NotificationPromptKind,
    transaction,
  };
}

/** Every category this spend could go in. For the expanded keyboard. */
export async function listPromptChoices(
  userId: UserId,
  context: PromptContext,
): Promise<CategoryRow[]> {
  return listCategories(userId, { type: categoryTypeFor(context.transaction) });
}

export type AnswerPromptResult =
  | {
      readonly ok: true;
      readonly transaction: TransactionRow;
      readonly category: CategoryRow;
      /** The engine filed a rule, so this merchant will not be asked about again. */
      readonly learned: boolean;
      /**
       * False when this exact prompt had already been answered - a redelivered
       * callback, or a second tap before the first edit landed. The category is
       * still applied (the same one, idempotently); what changes is that
       * nothing is COUNTED twice.
       */
      readonly firstAnswer: boolean;
    }
  | { readonly ok: false; readonly reason: 'unknown_category' | 'not_found' };

/**
 * Files the spend under the category the user tapped, and learns from it.
 *
 * The order matters and it is deliberate: the write happens first, the prompt
 * is marked answered second. If the process dies between them, Telegram
 * redelivers, the category is re-applied to the same value, and the metric is
 * counted once - which is the failure mode worth designing for. Marking first
 * would leave a prompt recorded as answered with nothing written behind it.
 */
export async function answerCategoryPrompt(
  userId: UserId,
  context: PromptContext,
  categoryId: string,
): Promise<AnswerPromptResult> {
  const result = await categorizeTransaction(userId, context.transaction.id, categoryId);
  if (!result.ok) {
    return result;
  }

  const firstAnswer = await markPromptAnswered(userId, context.promptId);

  return {
    ok: true,
    transaction: result.transaction,
    category: result.category,
    learned: result.learned,
    firstAnswer,
  };
}

export type CreateCategoryForPromptResult =
  | AnswerPromptResult
  | { readonly ok: false; readonly reason: 'invalid' | 'duplicate' | 'failed' };

/**
 * A category that did not exist yet, created and applied in one gesture.
 *
 * The icon and colour are the defaults, and that is the point: the chat is
 * where you are standing at the counter, not where you pick a palette. The
 * category shows up in the PWA's drawer afterwards and can be dressed there.
 */
export async function createCategoryForPrompt(
  userId: UserId,
  context: PromptContext,
  name: string,
): Promise<CreateCategoryForPromptResult> {
  const created = await createUserCategory(userId, {
    name,
    type: categoryTypeFor(context.transaction),
  });

  if (!created.ok) {
    return { ok: false, reason: created.reason };
  }

  return answerCategoryPrompt(userId, context, created.category.id);
}

/**
 * Records a second message that asks about the same spend.
 *
 * The "type the name" message is a prompt too: it is what the user's reply
 * will be threaded to, and without a row there is no way back from that reply
 * to the transaction. It returns nothing because the caller has already sent
 * the message - failing to record it costs the reply, not the spend.
 *
 * NOTE FOR METRICS (P6): this makes `answered_at` a count of PROMPTS, not of
 * transactions. The level 2 gesture metric filters on kind = 'category_pick',
 * or the "create a category" path reads as two questions for one spend.
 */
export async function trackFollowUpPrompt(
  userId: UserId,
  provider: NotificationProvider,
  chatId: bigint,
  externalMessageId: bigint,
  transactionId: string,
): Promise<void> {
  try {
    await recordPrompt(userId, {
      transactionId,
      provider,
      kind: 'category_name',
      chatId,
      externalMessageId,
    });
  } catch (error) {
    console.error('[notification] could not track a follow-up prompt:', error);
  }
}
