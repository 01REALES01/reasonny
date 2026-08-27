/**
 * Transaction repository.
 *
 * Implements tenant-isolated transaction persistence, client-side idempotency,
 * atomic two-leg transfers, soft-deletes, and filtering.
 */
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

import type { AccountId, CategoryId, TransactionId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { transactions } from '@/infrastructure/db/schema';

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

export interface CreateTransferInput {
  readonly fromAccountId: AccountId;
  readonly toAccountId: AccountId;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description?: string;
  readonly transactionDate: Date;
  readonly source?: TransactionSource;
  readonly idempotencyKey?: string | null;
}

export interface ListTransactionsOptions {
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly accountId?: AccountId;
  readonly categoryId?: CategoryId;
  readonly type?: TransactionType;
  readonly status?: TransactionStatus;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpdateTransactionInput {
  readonly accountId?: AccountId | null;
  readonly categoryId?: CategoryId | null;
  readonly amountMinor?: bigint;
  readonly currency?: string;
  readonly status?: TransactionStatus;
  readonly merchant?: string;
  readonly merchantNormalized?: string | null;
  readonly note?: string | null;
  readonly transactionDate?: Date;
  readonly categorizedBy?: CategorizedBy | null;
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
 * Creates an atomic two-legged transfer between two accounts.
 *
 * WHY A TRANSACTION WITH TWO LEGS
 * -------------------------------
 * A transfer moves money from account A to account B. Storing a single account_id
 * cannot balance both accounts without synthetic arithmetic. Two linked legs
 * sharing a `transfer_group_id` ensure both accounts update consistently.
 */
export async function createTransfer(
  userId: UserId,
  input: CreateTransferInput,
): Promise<{ outgoing: TransactionRow; incoming: TransactionRow }> {
  const db = getDb();
  const transferGroupId = crypto.randomUUID();
  const description = input.description ?? 'Transfer';

  return db.transaction(async (tx) => {
    // Leg 1: Outgoing leg (from account)
    const [outgoing] = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: input.fromAccountId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        type: 'transfer',
        status: 'confirmed',
        merchant: `Transfer to account: ${input.toAccountId}`,
        note: description,
        transactionDate: input.transactionDate,
        source: input.source ?? 'manual',
        transferGroupId,
      })
      .returning();

    // Leg 2: Incoming leg (to account)
    const [incoming] = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: input.toAccountId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        type: 'transfer',
        status: 'confirmed',
        merchant: `Transfer from account: ${input.fromAccountId}`,
        note: description,
        transactionDate: input.transactionDate,
        source: input.source ?? 'manual',
        transferGroupId,
      })
      .returning();

    if (!outgoing || !incoming) {
      throw new Error('Failed to create both legs of the transfer.');
    }

    return { outgoing, incoming };
  });
}

export async function getTransaction(
  userId: UserId,
  transactionId: TransactionId,
): Promise<TransactionRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
    .limit(1);
  return row ?? null;
}

export async function listTransactions(
  userId: UserId,
  options?: ListTransactionsOptions,
): Promise<TransactionRow[]> {
  const db = getDb();
  const conditions = [eq(transactions.userId, userId)];

  if (!options?.includeDeleted) {
    conditions.push(isNull(transactions.deletedAt));
  }
  if (options?.startDate) {
    conditions.push(gte(transactions.transactionDate, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(transactions.transactionDate, options.endDate));
  }
  if (options?.accountId) {
    conditions.push(eq(transactions.accountId, options.accountId));
  }
  if (options?.categoryId) {
    conditions.push(eq(transactions.categoryId, options.categoryId));
  }
  if (options?.type) {
    conditions.push(eq(transactions.type, options.type));
  }
  if (options?.status) {
    conditions.push(eq(transactions.status, options.status));
  }

  let query = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

  if (options?.limit !== undefined) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset !== undefined) {
    query = query.offset(options.offset) as typeof query;
  }

  return query;
}

export async function updateTransaction(
  userId: UserId,
  transactionId: TransactionId,
  input: UpdateTransactionInput,
): Promise<TransactionRow | null> {
  const db = getDb();
  const [row] = await db
    .update(transactions)
    .set({
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
      ...(input.merchantNormalized !== undefined
        ? { merchantNormalized: input.merchantNormalized }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.transactionDate !== undefined
        ? { transactionDate: input.transactionDate }
        : {}),
      ...(input.categorizedBy !== undefined
        ? { categorizedBy: input.categorizedBy }
        : {}),
      ...(input.receiptObjectKey !== undefined
        ? { receiptObjectKey: input.receiptObjectKey }
        : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
    .returning();

  return row ?? null;
}

/**
 * Soft deletes a transaction.
 *
 * In a personal finance application, financial records are never hard deleted.
 */
export async function softDeleteTransaction(
  userId: UserId,
  transactionId: TransactionId,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .update(transactions)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
    .returning();

  return Boolean(row);
}

/**
 * Lists uncategorized transactions for Level-2 interactive classification.
 */
export async function getUncategorizedTransactions(
  userId: UserId,
  limit = 50,
): Promise<TransactionRow[]> {
  const db = getDb();
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.categoryId),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}
