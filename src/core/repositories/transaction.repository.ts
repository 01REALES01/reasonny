/**
 * Transaction repository.
 *
 * Implements tenant-isolated transaction persistence with client-side
 * idempotency, plus the aggregations the dashboard and the CSV export read.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AccountId, CategoryId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { accounts, categories, transactions } from '@/infrastructure/db/schema';

export type TransactionRow = typeof transactions.$inferSelect;

export type TransactionType = 'expense' | 'income' | 'transfer';
export type TransactionStatus =
  | 'confirmed'
  | 'pending_review'
  | 'pending_auth'
  | 'declined';
export type TransactionSource =
  | 'wallet_nfc'
  | 'sms_shortcut'
  | 'ocr_screenshot'
  | 'manual'
  | 'telegram_text'
  | 'csv_import';
export type CategorizedBy =
  | 'rule_engine'
  | 'telegram'
  | 'shortcut_menu'
  | 'manual'
  | 'ocr';

export interface CreateTransactionInput {
  readonly accountId?: AccountId | null;
  readonly categoryId?: CategoryId | null;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly type: TransactionType;
  readonly status?: TransactionStatus;
  readonly merchant: string;
  readonly merchantNormalized?: string | null;
  readonly note?: string | null;
  readonly transactionDate: Date;
  readonly source: TransactionSource;
  readonly idempotencyKey?: string | null;
  readonly ocrConfidence?: string | null;
  readonly categorizedBy?: CategorizedBy | null;
  readonly transferGroupId?: string | null;
  readonly receiptObjectKey?: string | null;
}

export async function createTransaction(
  userId: UserId,
  input: CreateTransactionInput,
): Promise<{ transaction: TransactionRow; isDuplicate: boolean }> {
  const db = getDb();

  // If idempotencyKey is provided, check if it already exists to return the original row
  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { transaction: existing[0], isDuplicate: true };
    }
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      type: input.type,
      status: input.status ?? 'confirmed',
      merchant: input.merchant,
      merchantNormalized: input.merchantNormalized,
      note: input.note,
      transactionDate: input.transactionDate,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      ocrConfidence: input.ocrConfidence,
      categorizedBy: input.categorizedBy,
      transferGroupId: input.transferGroupId,
      receiptObjectKey: input.receiptObjectKey,
    })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    // If onConflictDoNothing prevented insert due to concurrent race on idempotencyKey,
    // fetch and return the colliding row.
    if (input.idempotencyKey) {
      const colliding = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (colliding[0]) {
        return { transaction: colliding[0], isDuplicate: true };
      }
    }
    throw new Error(`Failed to insert transaction for user ${userId}`);
  }

  return { transaction: row, isDuplicate: false };
}

/**
 * How many transactions are still waiting to be categorised.
 *
 * A count, not a list. This used to select up to a hundred full rows so the
 * dashboard could read .length off the array - every column of every row over
 * the wire, on the page whose LCP budget has to absorb a Neon cold start, to
 * render one number. It also silently capped: a user with 140 uncategorised
 * rows was told they had 100.
 *
 * The list version comes back in phase 2 with the review screen that needs it.
 */
export async function countUncategorizedTransactions(userId: UserId): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.categoryId),
        isNull(transactions.deletedAt),
      ),
    );
  return row?.count ?? 0;
}

export interface MonthlyTotals {
  readonly totalExpenseMinor: bigint;
  readonly totalIncomeMinor: bigint;
  readonly transactionCount: number;
}

/**
 * Calculates monthly totals aggregated with timezone awareness.
 *
 * WHY AT TIME ZONE IS MANDATORY (CLAUDE.md Rule 4)
 * -----------------------------------------------
 * Grouping strictly in UTC causes late-evening transactions at month boundaries
 * (e.g. Aug 31 at 20:00 in Bogotá UTC-5) to fall into the next month.
 */
export async function getMonthlyTotals(
  userId: UserId,
  timezone: string,
  startOfMonthLocalIso: string,
  startOfNextMonthLocalIso: string,
): Promise<MonthlyTotals> {
  const db = getDb();

  const [result] = await db
    .select({
      totalExpense: sql<bigint>`
        COALESCE(
          SUM(
            CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amountMinor} ELSE 0 END
          ),
          0
        )
      `.mapWith((val) => (typeof val === 'bigint' ? val : BigInt(val ?? 0))),
      totalIncome: sql<bigint>`
        COALESCE(
          SUM(
            CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountMinor} ELSE 0 END
          ),
          0
        )
      `.mapWith((val) => (typeof val === 'bigint' ? val : BigInt(val ?? 0))),
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.status, 'confirmed'),
        sql`(${transactions.transactionDate} AT TIME ZONE ${timezone}) >= ${startOfMonthLocalIso}::timestamp`,
        sql`(${transactions.transactionDate} AT TIME ZONE ${timezone}) < ${startOfNextMonthLocalIso}::timestamp`,
      ),
    );

  return {
    totalExpenseMinor: result?.totalExpense ?? 0n,
    totalIncomeMinor: result?.totalIncome ?? 0n,
    transactionCount: result?.count ?? 0,
  };
}

export interface CategorySpendingBreakdown {
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly categoryIcon: string;
  readonly categoryColor: string;
  readonly totalMinor: bigint;
  readonly transactionCount: number;
}

/**
 * Aggregates expense breakdown by category within the given timezone-adjusted monthly boundary.
 */
export async function getCategorySpendingBreakdown(
  userId: UserId,
  timezone: string,
  startOfMonthLocalIso: string,
  startOfNextMonthLocalIso: string,
): Promise<CategorySpendingBreakdown[]> {
  const db = getDb();

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: sql<string>`COALESCE(${categories.name}, 'Sin Categoría')`,
      categoryIcon: sql<string>`COALESCE(${categories.icon}, 'HelpCircle')`,
      categoryColor: sql<string>`COALESCE(${categories.color}, '#6B7280')`,
      totalMinor: sql<bigint>`
        COALESCE(SUM(${transactions.amountMinor}), 0)
      `.mapWith((val) => (typeof val === 'bigint' ? val : BigInt(val ?? 0))),
      count: sql<number>`COUNT(${transactions.id})::int`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.status, 'confirmed'),
        eq(transactions.type, 'expense'),
        sql`(${transactions.transactionDate} AT TIME ZONE ${timezone}) >= ${startOfMonthLocalIso}::timestamp`,
        sql`(${transactions.transactionDate} AT TIME ZONE ${timezone}) < ${startOfNextMonthLocalIso}::timestamp`,
      ),
    )
    .groupBy(
      transactions.categoryId,
      categories.name,
      categories.icon,
      categories.color,
    )
    .orderBy(desc(sql`SUM(${transactions.amountMinor})`));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryIcon: r.categoryIcon,
    categoryColor: r.categoryColor,
    totalMinor: r.totalMinor,
    transactionCount: r.count,
  }));
}

export interface EnrichedTransactionRow {
  readonly id: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly merchant: string;
  readonly note: string | null;
  readonly transactionDate: Date;
  readonly categorizedBy: CategorizedBy | null;
  readonly category: {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly color: string;
  } | null;
  readonly account: {
    readonly id: string;
    readonly name: string;
    readonly currency: string;
  } | null;
}

/**
 * Fetches recent transactions enriched with category and account details.
 */
export async function getRecentEnrichedTransactions(
  userId: UserId,
  limit = 20,
): Promise<EnrichedTransactionRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: transactions.id,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      type: transactions.type,
      status: transactions.status,
      merchant: transactions.merchant,
      note: transactions.note,
      transactionDate: transactions.transactionDate,
      categorizedBy: transactions.categorizedBy,
      catId: categories.id,
      catName: categories.name,
      catIcon: categories.icon,
      catColor: categories.color,
      accId: accounts.id,
      accName: accounts.name,
      accCurrency: accounts.currency,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    amountMinor: r.amountMinor,
    currency: r.currency,
    type: r.type as TransactionType,
    status: r.status as TransactionStatus,
    merchant: r.merchant,
    note: r.note,
    transactionDate: r.transactionDate,
    categorizedBy: r.categorizedBy as CategorizedBy | null,
    category: r.catId
      ? {
          id: r.catId,
          name: r.catName ?? 'Categoría',
          icon: r.catIcon ?? 'Tag',
          color: r.catColor ?? '#6B7280',
        }
      : null,
    account: r.accId
      ? {
          id: r.accId,
          name: r.accName ?? 'Cuenta',
          currency: r.accCurrency ?? 'COP',
        }
      : null,
  }));
}

