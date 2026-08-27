/**
 * Budget repository.
 *
 * Enforces per-period monthly budgets without overwriting past history.
 */
import { and, eq } from 'drizzle-orm';

import type { BudgetId, CategoryId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { budgets } from '@/infrastructure/db/schema';

export type BudgetRow = typeof budgets.$inferSelect;

export interface UpsertBudgetInput {
  readonly categoryId: CategoryId;
  readonly periodStart: string; // 'YYYY-MM-01'
  readonly amountMinor: bigint;
}

export async function listBudgetsForPeriod(
  userId: UserId,
  periodStart: string,
): Promise<BudgetRow[]> {
  const db = getDb();
  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.periodStart, periodStart)));
}

export async function upsertBudget(
  userId: UserId,
  input: UpsertBudgetInput,
): Promise<BudgetRow> {
  const db = getDb();
  const [row] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId: input.categoryId,
      periodStart: input.periodStart,
      amountMinor: input.amountMinor,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.periodStart],
      set: { amountMinor: input.amountMinor },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to upsert budget for user ${userId}`);
  }
  return row;
}

export async function deleteBudget(
  userId: UserId,
  budgetId: BudgetId,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, budgetId)))
    .returning();

  return Boolean(row);
}
