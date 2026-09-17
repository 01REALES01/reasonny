/**
 * Transaction repository.
 *
 * Implements tenant-isolated transaction persistence with client-side
 * idempotency, plus the aggregations the dashboard and the CSV export read.
 */
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { normalizeMerchant } from '@/core/categorization';
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
  // No merchantNormalized here on purpose: it is derived from `merchant`, and a
  // caller that could pass it could pass one that disagrees. Every write path
  // did exactly that - three hand-rolled variants, none of them stripping
  // accents - so "Café Juan Valdez" and "CAFE JUAN VALDEZ" became two keys and
  // idx_tx_dedupe never saw the duplicate.
  readonly note?: string | null;
  readonly transactionDate: Date;
  readonly source: TransactionSource;
  readonly idempotencyKey?: string | null;
  readonly ocrConfidence?: string | null;
  readonly categorizedBy?: CategorizedBy | null;
  readonly transferGroupId?: string | null;
  readonly receiptObjectKey?: string | null;
  /**
   * Where the device was. Written only when the profile has location enabled;
   * the caller decides that, because the profile is already loaded there.
   */
  readonly location?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyM?: number | null;
    readonly source: 'device_pwa' | 'shortcut' | 'manual';
  } | null;
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
      // '' means "no key" (see normalizeMerchant): as a rule pattern it would
      // match every blank merchant at once, so it is stored as absent.
      merchantNormalized: normalizeMerchant(input.merchant) || null,
      note: input.note,
      transactionDate: input.transactionDate,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      ocrConfidence: input.ocrConfidence,
      categorizedBy: input.categorizedBy,
      transferGroupId: input.transferGroupId,
      receiptObjectKey: input.receiptObjectKey,
      // Written as text because the column is numeric: the driver would hand a
      // JS number to Postgres as a float literal, which is the one
      // representation this column exists to avoid.
      latitude: input.location ? String(input.location.latitude) : null,
      longitude: input.location ? String(input.location.longitude) : null,
      locationAccuracyM: input.location?.accuracyM ?? null,
      locationSource: input.location?.source ?? null,
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
/**
 * Whether this user has ever recorded anything.
 *
 * EXISTS with LIMIT 1, not COUNT(*): the question is "any at all", and counting
 * every row of a long history to compare it against zero is work thrown away.
 */
export async function hasAnyTransaction(userId: UserId): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .limit(1);

  return rows.length > 0;
}

/**
 * Turns whatever the driver hands back for a timestamptz into a Date.
 *
 * `sql<Date>` is an ASSERTION, not a conversion: it tells TypeScript what to
 * believe and does nothing at runtime. The neon-serverless driver returns a
 * bare aggregate as text, so the value arrived as
 * "2026-09-09 23:42:44.225699+00" while every caller had been promised a Date -
 * and the first `.toISOString()` on it took the profile page down with a 500.
 * It could only ever fail once a row existed, which is why it shipped: with no
 * captured transaction, MAX returns null and the optional chain skips it.
 *
 * The string is normalised rather than handed straight to `new Date`: a space
 * instead of the T and a two-digit offset make it non-ISO, and Date's handling
 * of non-ISO input is implementation-defined. It parses today in V8. That is
 * not the same as being specified to.
 *
 * Exported for its test.
 */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;

  const iso = String(value).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface AutomaticCaptureStatus {
  /** Transactions this user has received from the SMS automation, ever. */
  readonly count: number;
  /** When the most recent one ARRIVED, not when the bank says it happened. */
  readonly lastAt: Date | null;
}

/**
 * Whether the automatic capture pipe has ever actually delivered.
 *
 * The setup wizard used to declare itself finished on the strength of eight
 * taps stored in localStorage, which proves the user read eight screens and
 * nothing else. A mistyped token, the wrong sender number, or a shortcut left
 * unsaved all end at the same congratulation. This is the only version of the
 * question the server can answer: rows exist, or they do not.
 *
 * created_at rather than transaction_date, because the question is when the
 * message reached us. A bank SMS can describe a purchase from yesterday, and
 * dating the health of the pipe by the purchase would report an outage that is
 * not happening - or hide one that is.
 */
export async function getAutomaticCaptureStatus(
  userId: UserId,
): Promise<AutomaticCaptureStatus> {
  const db = getDb();
  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      // mapWith, like every other aggregate in this file. Without it the
      // declared type is a promise the runtime does not keep.
      lastAt: sql<Date | null>`MAX(${transactions.transactionDate})`.mapWith(toDateOrNull),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.source, 'sms_shortcut'),
        isNull(transactions.deletedAt),
      ),
    );

  return { count: row?.count ?? 0, lastAt: row?.lastAt ?? null };
}

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

export interface DailyExpenseTotal {
  /** Calendar day in the profile's zone, 'YYYY-MM-DD'. */
  readonly day: string;
  readonly totalExpenseMinor: bigint;
}

/**
 * Confirmed spending per local calendar day, from `startLocalIso` on.
 *
 * The day is cut in SQL, in the user's zone (CLAUDE.md rule 4): a spend at
 * 21:00 in Bogotá is already the next day in UTC.
 *
 * With no end bound the query also covers future-dated rows, which the
 * dashboard lists too - so every day header it draws has a total behind it.
 *
 * GROUP BY 1 rather than repeating the expression: Drizzle binds the timezone
 * as a fresh parameter each time it appears, and Postgres does not treat
 * `AT TIME ZONE $1` and `AT TIME ZONE $6` as the same grouping expression.
 *
 * Like getMonthlyTotals, this adds amount_minor across currencies and the
 * caller renders it in the base one. Correct while every row is in the base
 * currency, which is all Fase 1 has; the day and the month have to be fixed
 * together, or the headers would stop summing to the total above them.
 */
export async function getDailyExpenseTotals(
  userId: UserId,
  timezone: string,
  startLocalIso: string,
  endLocalIso?: string,
): Promise<DailyExpenseTotal[]> {
  const db = getDb();

  const localDate = sql`(${transactions.transactionDate} AT TIME ZONE ${timezone})`;

  const rows = await db
    .select({
      day: sql<string>`to_char(${localDate}, 'YYYY-MM-DD')`,
      total: sql<bigint>`COALESCE(SUM(${transactions.amountMinor}), 0)`.mapWith((val) =>
        typeof val === 'bigint' ? val : BigInt(val ?? 0),
      ),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.status, 'confirmed'),
        eq(transactions.type, 'expense'),
        sql`${localDate} >= ${startLocalIso}::timestamp`,
        endLocalIso ? sql`${localDate} < ${endLocalIso}::timestamp` : undefined,
      ),
    )
    .groupBy(sql`1`);

  return rows.map((r) => ({ day: r.day, totalExpenseMinor: r.total }));
}

/**
 * Erases every stored coordinate for one user, and reports how many rows lost
 * one.
 *
 * A real delete, not a soft one. Everything else in this file is soft-deleted
 * because it is money and money is auditable; a location is the opposite kind
 * of data - the user asking for it to be gone is the whole point, and a row
 * that still holds the coordinate in a "deleted" column has not honoured that.
 *
 * The count is returned so the interface can say what happened rather than
 * claiming success over a no-op.
 */
export async function clearAllLocations(userId: UserId): Promise<number> {
  const db = getDb();

  const rows = await db
    .update(transactions)
    .set({
      latitude: null,
      longitude: null,
      locationAccuracyM: null,
      locationSource: null,
    })
    .where(and(eq(transactions.userId, userId), isNotNull(transactions.latitude)))
    .returning({ id: transactions.id });

  return rows.length;
}

export interface CategorySpendingBreakdown {
  readonly categoryId: string | null;
  /**
   * null for the uncategorised bucket, not a label.
   *
   * This used to be COALESCE(categories.name, 'Sin Categoría') - a Spanish UI
   * string invented inside a SQL query, which no amount of i18n at the edge
   * could ever translate. The repository reports the absence; naming it is the
   * caller's job, through the catalog.
   */
  readonly categoryName: string | null;
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
      categoryName: categories.name,
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
  readonly source: TransactionSource;
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
  /**
   * null when the spend carries no coordinate, which is most of them: SMS and
   * OCR never have one, and the feature is off until the user turns it on.
   */
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyM: number | null;
    readonly source: string | null;
  } | null;
}

// The enriched projection and its row mapping are shared by every screen that
// lists or opens a transaction. Written once so the detail view, the review
// inbox and the dashboard cannot drift apart in what they select or how they
// name a missing category.
const ENRICHED_COLUMNS = {
  id: transactions.id,
  amountMinor: transactions.amountMinor,
  currency: transactions.currency,
  type: transactions.type,
  status: transactions.status,
  source: transactions.source,
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
  latitude: transactions.latitude,
  longitude: transactions.longitude,
  locationAccuracyM: transactions.locationAccuracyM,
  locationSource: transactions.locationSource,
} as const;

// Written out rather than mapped over ENRICHED_COLUMNS: a mapped type reads the
// column's data type but not its nullability, so every left-joined column came
// back as non-null and the mapper's `?? 'Categoría'` fallbacks looked dead.
// The category and account columns are all nullable because both joins are LEFT.
interface EnrichedQueryRow {
  readonly id: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly type: string;
  readonly status: string;
  readonly source: string;
  readonly merchant: string;
  readonly note: string | null;
  readonly transactionDate: Date;
  readonly categorizedBy: string | null;
  readonly catId: string | null;
  readonly catName: string | null;
  readonly catIcon: string | null;
  readonly catColor: string | null;
  readonly accId: string | null;
  readonly accName: string | null;
  readonly accCurrency: string | null;
  // numeric columns arrive as strings from the driver, which is exactly why
  // they are numeric: no float ever touches the value on the way here.
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly locationAccuracyM: number | null;
  readonly locationSource: string | null;
}

function toEnrichedRow(r: EnrichedQueryRow): EnrichedTransactionRow {
  return {
    id: r.id,
    amountMinor: r.amountMinor,
    currency: r.currency,
    type: r.type as TransactionType,
    status: r.status as TransactionStatus,
    source: r.source as TransactionSource,
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
    // Both or neither - the CHECK constraint guarantees it, and this reads the
    // pair the same way rather than trusting one of them alone.
    location:
      r.latitude !== null && r.longitude !== null
        ? {
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            accuracyM: r.locationAccuracyM,
            source: r.locationSource,
          }
        : null,
  };
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
    .select(ENRICHED_COLUMNS)
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

  return rows.map(toEnrichedRow);
}

/**
 * Transactions inside one month, for the month view.
 *
 * Bounds are the same local-midnight strings the aggregations use, compared
 * `AT TIME ZONE` like every other period query (CLAUDE.md rule 4): a spend at
 * 20:00 on 31 August in Bogotá belongs to August, and grouping in UTC would
 * file it under September.
 */
export async function getEnrichedTransactionsInMonth(
  userId: UserId,
  timezone: string,
  startOfMonthIso: string,
  startOfNextMonthIso: string,
  limit = 200,
): Promise<EnrichedTransactionRow[]> {
  const db = getDb();

  const localDate = sql`(${transactions.transactionDate} AT TIME ZONE ${timezone})`;

  const rows = await db
    .select(ENRICHED_COLUMNS)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        sql`${localDate} >= ${startOfMonthIso}::timestamp`,
        sql`${localDate} < ${startOfNextMonthIso}::timestamp`,
      ),
    )
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(limit);

  return rows.map(toEnrichedRow);
}

/**
 * The review queue: everything with no category yet.
 *
 * Ordered oldest first, unlike every other listing here. The queue exists to be
 * emptied, and the row most likely to be forgotten is the one that has been
 * waiting longest - showing the newest first would bury it.
 */
export async function listUncategorizedTransactions(
  userId: UserId,
  limit = 100,
): Promise<EnrichedTransactionRow[]> {
  const db = getDb();

  const rows = await db
    .select(ENRICHED_COLUMNS)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.categoryId),
      ),
    )
    .orderBy(transactions.transactionDate)
    .limit(limit);

  return rows.map(toEnrichedRow);
}

/**
 * One transaction, or null.
 *
 * userId is in the WHERE, not checked after the read: a detail page reached by
 * guessing a uuid must return nothing rather than another tenant's row.
 */
export async function getEnrichedTransaction(
  userId: UserId,
  transactionId: string,
): Promise<EnrichedTransactionRow | null> {
  const db = getDb();

  const rows = await db
    .select(ENRICHED_COLUMNS)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.id, transactionId),
        isNull(transactions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toEnrichedRow(rows[0]) : null;
}

export interface UpdateTransactionInput {
  readonly merchant?: string;
  readonly amountMinor?: bigint;
  readonly categoryId?: CategoryId | null;
  readonly note?: string | null;
  readonly transactionDate?: Date;
}

/**
 * Edits a transaction the user already recorded.
 *
 * Returns null when nothing matched, which is the same answer for "does not
 * exist" and "belongs to somebody else" - the caller must not be able to tell
 * those apart. Setting a category by hand marks categorizedBy 'manual', so a
 * later rule-engine pass can tell a human decision from its own guess and leave
 * it alone.
 */
export async function updateTransaction(
  userId: UserId,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionRow | null> {
  const db = getDb();

  const patch: Record<string, unknown> = {};
  if (input.merchant !== undefined) {
    patch.merchant = input.merchant;
    // The normalized column is what deduplication and the future rule engine
    // match on. Writing one without the other leaves the row claiming to be
    // one merchant and matching as another, and nothing would ever surface the
    // disagreement - createTransaction sets both, so only edits drifted.
    patch.merchantNormalized = normalizeMerchant(input.merchant) || null;
  }
  if (input.amountMinor !== undefined) patch.amountMinor = input.amountMinor;
  if (input.note !== undefined) patch.note = input.note;
  if (input.transactionDate !== undefined) {
    patch.transactionDate = input.transactionDate;
  }
  if (input.categoryId !== undefined) {
    patch.categoryId = input.categoryId;
    patch.categorizedBy = input.categoryId ? 'manual' : null;
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.id, transactionId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning();

  return row ?? null;
}

/**
 * Soft-deletes a transaction.
 *
 * Sets deleted_at rather than removing the row: in a money app the record that
 * a spend was deleted is itself part of the history, and every read here
 * already filters on `deletedAt IS NULL`.
 */
export async function softDeleteTransaction(
  userId: UserId,
  transactionId: string,
): Promise<boolean> {
  const db = getDb();

  const [row] = await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.id, transactionId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning({ id: transactions.id });

  return Boolean(row);
}

