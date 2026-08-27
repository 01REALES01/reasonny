/**
 * Categorization Rule repository.
 *
 * Rules drive Level-1 auto-categorization and track hit counts to measure learning.
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import type { CategoryId, RuleId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { categorizationRules } from '@/infrastructure/db/schema';

export type CategorizationRuleRow = typeof categorizationRules.$inferSelect;

export interface CreateRuleInput {
  readonly categoryId: CategoryId;
  readonly merchantPattern: string;
  readonly isRegex?: boolean;
  readonly priority?: number;
}

export interface UpdateRuleInput {
  readonly categoryId?: CategoryId;
  readonly merchantPattern?: string;
  readonly isRegex?: boolean;
  readonly priority?: number;
}

export async function listRules(userId: UserId): Promise<CategorizationRuleRow[]> {
  const db = getDb();
  return db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId))
    .orderBy(desc(categorizationRules.priority), desc(categorizationRules.createdAt));
}

export async function createRule(
  userId: UserId,
  input: CreateRuleInput,
): Promise<CategorizationRuleRow> {
  const db = getDb();
  const [row] = await db
    .insert(categorizationRules)
    .values({
      userId,
      categoryId: input.categoryId,
      merchantPattern: input.merchantPattern,
      isRegex: input.isRegex ?? false,
      priority: input.priority ?? 0,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create categorization rule for user ${userId}`);
  }
  return row;
}

export async function updateRule(
  userId: UserId,
  ruleId: RuleId,
  input: UpdateRuleInput,
): Promise<CategorizationRuleRow | null> {
  const db = getDb();
  const [row] = await db
    .update(categorizationRules)
    .set({
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.merchantPattern !== undefined
        ? { merchantPattern: input.merchantPattern }
        : {}),
      ...(input.isRegex !== undefined ? { isRegex: input.isRegex } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    })
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.id, ruleId),
      ),
    )
    .returning();

  return row ?? null;
}

export async function deleteRule(
  userId: UserId,
  ruleId: RuleId,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .delete(categorizationRules)
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.id, ruleId),
      ),
    )
    .returning();

  return Boolean(row);
}

export async function incrementRuleHitCount(
  userId: UserId,
  ruleId: RuleId,
): Promise<void> {
  const db = getDb();
  await db
    .update(categorizationRules)
    .set({ hitCount: sql`${categorizationRules.hitCount} + 1` })
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.id, ruleId),
      ),
    );
}
