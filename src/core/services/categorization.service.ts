import { normalizeMerchant } from '@/core/categorization';
import { getCategory } from '@/core/repositories/category.repository';
import {
  findRuleForMerchant,
  learnRule,
  recordRuleHit,
  type RuleType,
} from '@/core/repositories/categorization-rule.repository';
import {
  updateTransaction,
  type TransactionRow,
  type TransactionType,
} from '@/core/repositories/transaction.repository';
import { toCategoryId, type CategoryId, type UserId } from '@/core/types';

/**
 * The rule engine: level 1 of the three capture levels.
 *
 * Two halves of one loop. `suggestCategory` is the engine answering on its own
 * - zero gestures, the destination. `categorizeTransaction` is a human
 * answering instead, and the engine writing down what they said so it does not
 * have to ask again.
 *
 * The second half is why level 2 is scaffolding rather than a treadmill. A
 * button you tap forever is a worse form of manual entry; a button you tap
 * once per merchant is teaching. Whether that is actually happening is
 * measurable - categorization_rules.hit_count and the share of transactions
 * with categorized_by = 'rule_engine' - and METRICS.md is where it gets
 * reported, with n (P6).
 *
 * Both halves live here and not in a client because the PWA's review queue,
 * the edit form and the Telegram keyboard are three ways of saying the same
 * sentence (P9).
 */

/** Rules exist for directions of money; a transfer between accounts has none. */
function asRuleType(type: TransactionType): RuleType | null {
  return type === 'expense' || type === 'income' ? type : null;
}

export interface CategorySuggestion {
  readonly categoryId: CategoryId;
  readonly ruleId: string;
}

/**
 * What the engine believes this merchant is, or nothing.
 *
 * Nothing is a perfectly good answer and the common one early on: an empty
 * rule table means every transaction arrives uncategorised, which is what
 * /revisar is for. Guessing would put a wrong colour in the dashboard's
 * breakdown that nobody would think to correct.
 */
export async function suggestCategory(
  userId: UserId,
  merchant: string,
  type: TransactionType,
): Promise<CategorySuggestion | null> {
  const ruleType = asRuleType(type);
  if (!ruleType) {
    return null;
  }

  // The same function that produced the key stored on the transaction. Never a
  // second spelling of the rule - see the header of core/categorization.ts.
  const key = normalizeMerchant(merchant);
  if (!key) {
    return null;
  }

  return findRuleForMerchant(userId, key, ruleType);
}

/** Counts one firing. Called only after the write it informed actually landed. */
export async function confirmSuggestionUsed(
  userId: UserId,
  suggestion: CategorySuggestion,
): Promise<void> {
  try {
    await recordRuleHit(userId, suggestion.ruleId);
  } catch (error) {
    // A counter is telemetry. Failing to increment it must never undo a
    // transaction that is already stored.
    console.error('[categorization] could not count a rule hit:', error);
  }
}

/**
 * Files the rule a stored transaction implies, if it implies one.
 *
 * Reads the row rather than the caller's intent: the key is whatever
 * merchant_normalized ended up as, which is the only value that will be
 * matched against on the next ingestion.
 *
 * Never throws. The user's correction is the thing that had to be saved; the
 * rule is an optimisation for next time, and losing it must not turn a
 * successful edit into an error on screen.
 */
export async function learnFromTransaction(
  userId: UserId,
  transaction: TransactionRow,
): Promise<boolean> {
  const ruleType = asRuleType(transaction.type as TransactionType);
  const key = transaction.merchantNormalized;

  if (!ruleType || !key || !transaction.categoryId) {
    return false;
  }

  try {
    await learnRule(userId, {
      merchantPattern: key,
      categoryId: toCategoryId(transaction.categoryId),
      type: ruleType,
    });
    return true;
  } catch (error) {
    console.error('[categorization] could not learn the rule:', error);
    return false;
  }
}

export type CategorizeTransactionResult =
  | { readonly ok: true; readonly transaction: TransactionRow; readonly learned: boolean }
  | { readonly ok: false; readonly reason: 'unknown_category' | 'not_found' };

/**
 * A human states the category, and the engine learns it.
 *
 * The rule is derived from the transaction AFTER the update, not from what the
 * caller sent - see learnFromTransaction.
 */
export async function categorizeTransaction(
  userId: UserId,
  transactionId: string,
  categoryId: string,
): Promise<CategorizeTransactionResult> {
  let branded: CategoryId;
  try {
    branded = toCategoryId(categoryId);
  } catch {
    return { ok: false, reason: 'unknown_category' };
  }

  // Verified against this user before it is written. Accepting the id as-is
  // would let one tenant file a spend under another tenant's category.
  const category = await getCategory(userId, branded);
  if (!category) {
    return { ok: false, reason: 'unknown_category' };
  }

  const transaction = await updateTransaction(userId, transactionId, {
    categoryId: branded,
  });
  if (!transaction) {
    return { ok: false, reason: 'not_found' };
  }

  const learned = await learnFromTransaction(userId, transaction);
  return { ok: true, transaction, learned };
}
