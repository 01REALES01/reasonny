/**
 * Categorization rules: what the engine has learned about a merchant.
 *
 * One rule says "spends at this merchant, in this direction, go to this
 * category". It is written when a human states the answer - the review queue,
 * the edit form, a Telegram button - and read on every ingestion.
 *
 * WHY THE LOOKUP IS AN EQUALITY AND NOT A SCAN WITH PRIORITIES
 * -----------------------------------------------------------
 * uq_rules_merchant covers (user_id, merchant_pattern, type, is_regex), so an
 * exact key can match at most one row and the index seeks straight to it. A
 * `priority DESC` tie-break only means something once patterns can overlap -
 * substring or regex - and neither exists yet. Loading every rule to pick one
 * in JavaScript would be slower and would invent an ordering the data cannot
 * actually produce.
 */
import { and, eq, sql } from 'drizzle-orm';

import type { CategoryId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { categories, categorizationRules } from '@/infrastructure/db/schema';

export type CategorizationRuleRow = typeof categorizationRules.$inferSelect;

/** Rules exist for directions of money, never for a transfer between accounts. */
export type RuleType = 'expense' | 'income';

export interface LearnRuleInput {
  /** A key from normalizeMerchant. Never a raw merchant name. */
  readonly merchantPattern: string;
  readonly categoryId: CategoryId;
  readonly type: RuleType;
}

export interface MatchedRule {
  readonly ruleId: string;
  readonly categoryId: CategoryId;
  /**
   * The category's own columns, carried back from the join that was already
   * being done for isolation. Free here, and it saves the caller a second
   * SELECT purely to be able to say WHICH category the engine picked - which
   * is the one thing that makes level 1 visible to the user at all.
   */
  readonly categoryName: string;
  readonly categoryIcon: string;
}

/**
 * The rule for this exact merchant key, if one has been learned.
 *
 * The join to `categories` is not decoration. It pins the returned category to
 * the same user, so a rule row that somehow pointed at another tenant's
 * category could not hand it back - and the caller writes this id onto a
 * transaction without checking it again, precisely because this query already
 * did.
 *
 * is_regex = false because the native RegExp engine is never run on a
 * user-supplied pattern (ReDoS blocks the event loop) and node-re2 is not a
 * dependency. A regex rule, if one is ever stored, is skipped rather than
 * silently treated as a literal.
 */
export async function findRuleForMerchant(
  userId: UserId,
  merchantPattern: string,
  type: RuleType,
): Promise<MatchedRule | null> {
  // '' is "no key" (see normalizeMerchant): as a pattern it would match every
  // blank merchant at once, so it is never looked up.
  if (!merchantPattern) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .select({
      ruleId: categorizationRules.id,
      categoryId: categorizationRules.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(categorizationRules)
    .innerJoin(
      categories,
      and(
        eq(categories.id, categorizationRules.categoryId),
        eq(categories.userId, userId),
      ),
    )
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.merchantPattern, merchantPattern),
        eq(categorizationRules.type, type),
        eq(categorizationRules.isRegex, false),
      ),
    )
    .limit(1);

  return row
    ? {
        ruleId: row.ruleId,
        categoryId: row.categoryId as CategoryId,
        categoryName: row.categoryName,
        categoryIcon: row.categoryIcon,
      }
    : null;
}

/**
 * Teaches the engine, or corrects what it had learned.
 *
 * INSERT ... ON CONFLICT DO UPDATE, never SELECT-then-INSERT (rule 6): two
 * taps on the same merchant at once must collide on uq_rules_merchant rather
 * than both inserting. The update is what makes a correction work - tapping a
 * different category for a merchant replaces the answer instead of leaving the
 * old rule to keep firing.
 *
 * hit_count is deliberately NOT reset on a correction. It counts how often the
 * engine acted on this merchant, which is the measure of whether level 1 is
 * learning at all, and that history does not become untrue because the answer
 * was refined.
 */
export async function learnRule(
  userId: UserId,
  input: LearnRuleInput,
): Promise<CategorizationRuleRow | null> {
  if (!input.merchantPattern) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .insert(categorizationRules)
    .values({
      userId,
      categoryId: input.categoryId,
      merchantPattern: input.merchantPattern,
      type: input.type,
      isRegex: false,
    })
    .onConflictDoUpdate({
      target: [
        categorizationRules.userId,
        categorizationRules.merchantPattern,
        categorizationRules.type,
        categorizationRules.isRegex,
      ],
      set: { categoryId: input.categoryId },
    })
    .returning();

  return row ?? null;
}

/**
 * Counts one firing of a rule.
 *
 * Separate from the lookup on purpose. Folding the increment into an
 * UPDATE ... RETURNING would save a round trip and then count a rule as having
 * fired on ingestions that turned out to be duplicates, which is exactly the
 * number this column exists to report honestly (P6).
 */
export async function recordRuleHit(userId: UserId, ruleId: string): Promise<void> {
  const db = getDb();
  await db
    .update(categorizationRules)
    .set({ hitCount: sql`${categorizationRules.hitCount} + 1` })
    .where(
      and(eq(categorizationRules.userId, userId), eq(categorizationRules.id, ruleId)),
    );
}

/**
 * How much the engine has learned, and how often it acted on it.
 *
 * `hits` is the number that says whether level 1 is working at all: rules
 * nobody's spending ever matches are a table that looks busy and does nothing.
 */
export async function getRuleStats(
  userId: UserId,
): Promise<{ rules: number; hits: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      rules: sql<number>`COUNT(*)::int`,
      hits: sql<number>`COALESCE(SUM(${categorizationRules.hitCount}), 0)::int`,
    })
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId));

  return row ?? { rules: 0, hits: 0 };
}
