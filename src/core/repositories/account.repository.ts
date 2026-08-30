/**
 * Account repository.
 *
 * Implements tenant-isolated CRUD for financial accounts and dynamic balance
 * computation (PROJECT_SPEC.md 5.1).
 */
import { and, eq, sql } from 'drizzle-orm';

import type { AccountId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { accounts, transactions } from '@/infrastructure/db/schema';

export type AccountRow = typeof accounts.$inferSelect;

export type AccountType =
  | 'checking'
  | 'credit_card'
  | 'savings'
  | 'cash'
  | 'digital_wallet';

export interface CreateAccountInput {
  readonly name: string;
  readonly type: AccountType;
  readonly currency?: string;
  readonly initialBalanceMinor?: bigint;
  readonly color?: string;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly type?: AccountType;
  readonly currency?: string;
  readonly color?: string;
  readonly isArchived?: boolean;
}

export async function listAccounts(
  userId: UserId,
  options?: { readonly includeArchived?: boolean },
): Promise<AccountRow[]> {
  const db = getDb();
  const conditions = [eq(accounts.userId, userId)];

  if (!options?.includeArchived) {
    conditions.push(eq(accounts.isArchived, false));
  }

  return db
    .select()
    .from(accounts)
    .where(and(...conditions))
    .orderBy(accounts.name);
}

export async function getAccount(
  userId: UserId,
  accountId: AccountId,
): Promise<AccountRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);
  return row ?? null;
}

export async function createAccount(
  userId: UserId,
  input: CreateAccountInput,
): Promise<AccountRow> {
  const db = getDb();
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      currency: input.currency ?? 'COP',
      initialBalanceMinor: input.initialBalanceMinor ?? 0n,
      color: input.color ?? '#3B82F6',
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create account "${input.name}" for user ${userId}`);
  }
  return row;
}

export async function updateAccount(
  userId: UserId,
  accountId: AccountId,
  input: UpdateAccountInput,
): Promise<AccountRow | null> {
  const db = getDb();
  const [row] = await db
    .update(accounts)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .returning();

  return row ?? null;
}

/**
 * Calculates current balance dynamically from initial balance and confirmed transactions.
 *
 * WHY CALCULATED AND NOT STORED
 * ------------------------------
 * A denormalized current_balance column desynchronises on the first edit, delete
 * or transfer. With indexed queries over confirmed transactions, summing
 * balance dynamically guarantees consistency (PROJECT_SPEC.md 5.1).
 */
export async function getAccountBalance(
  userId: UserId,
  accountId: AccountId,
): Promise<{ balanceMinor: bigint; currency: string } | null> {
  const db = getDb();

  const [result] = await db
    .select({
      currency: accounts.currency,
      balanceMinor: sql<bigint>`
        ${accounts.initialBalanceMinor} + COALESCE(
          SUM(
            CASE
              WHEN ${transactions.type} = 'income' THEN ${transactions.amountMinor}
              WHEN ${transactions.type} = 'expense' THEN -${transactions.amountMinor}
              ELSE 0
            END
          ),
          0
        )
      `.mapWith((val) => (typeof val === 'bigint' ? val : BigInt(val ?? 0))),
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, accounts.id),
        // The tenant filter belongs in the JOIN, not only in the WHERE below.
        //
        // The WHERE clause constrains `accounts`, so it picks the right
        // account - but this join matched every transaction pointing at that
        // account id regardless of who wrote it, and the SUM added them all.
        // transactions.account_id is a foreign key to accounts.id alone, not a
        // composite with user_id, so nothing in the schema prevented a row
        // owned by one user from referencing another user's account. The
        // result was another tenant's spending inside this balance - a wrong
        // number on the hero card, in a money app, with no error anywhere.
        eq(transactions.userId, userId),
        sql`${transactions.deletedAt} IS NULL`,
        eq(transactions.status, 'confirmed'),
      ),
    )
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .groupBy(accounts.id, accounts.currency, accounts.initialBalanceMinor);

  if (!result) return null;
  return {
    balanceMinor: result.balanceMinor,
    currency: result.currency,
  };
}
