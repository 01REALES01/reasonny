/**
 * Drizzle schema - the nine tables of PROJECT_SPEC.md section 5.
 *
 * What lives here: tables, columns, CHECKs, UNIQUEs and indexes. What does NOT
 * live here, because Drizzle cannot express it, is written by hand in the
 * migration: the set_updated_at() function and its triggers, and RLS.
 *
 * Two conventions the whole schema depends on:
 *
 *  - Money is BIGINT in minor units, scale 100 always ($45.000 COP = 4500000).
 *    Columns use mode 'bigint' so they surface as JS bigint, never as number:
 *    a JS number silently loses precision past 2^53 and cannot represent cents
 *    exactly. Arithmetic belongs in core/money.ts (B2), never here.
 *
 *  - User ids are UUID, matching neon_auth.user.id, which Managed Better Auth
 *    creates as a real table inside this same database. (The spec said TEXT and
 *    described an async users_sync mirror; that was the older Stack Auth model
 *    and does not exist here. Corrected in B3.)
 *
 *    There is still NO hard foreign key against neon_auth.user, even though the
 *    table is local and a FK would now be possible. Two reasons: neon_auth is a
 *    MANAGED schema that our migrations do not own, so a FK into it couples our
 *    schema to something Neon can change underneath us; and an ON DELETE CASCADE
 *    from there would erase a user's entire financial history the moment auth
 *    dropped the row. In an app where even a single transaction is soft-deleted,
 *    that is not an acceptable failure mode.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * PG18 ships uuidv7(). A v4 is random, so every insert lands at an arbitrary
 * point in the index and fragments it; a v7 carries a timestamp prefix, so rows
 * arrive in order at the right edge of the btree. Free, and strictly better for
 * insert-heavy tables.
 */
const primaryId = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// 1. Profiles ────────────────────────────────────────────────────────────────
export const profiles = pgTable('profiles', {
  // Supplied by Neon Auth, never generated here.
  id: uuid().primaryKey(),
  email: text().notNull(),
  fullName: text('full_name'),
  baseCurrency: char('base_currency', { length: 3 }).notNull().default('COP'),
  timezone: text().notNull().default('America/Bogota'),
  // Telegram chat binding. NULL means the bot is not linked yet. UNIQUE because
  // one chat drives one profile: the webhook resolves the user from it.
  telegramChatId: bigint('telegram_chat_id', { mode: 'bigint' }).unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// 2. API keys ────────────────────────────────────────────────────────────────
// Only the sha256 of the key is stored. A dump of this table must not hand
// anyone write access; that was the v1 defect.
export const apiKeys = pgTable(
  'api_keys',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar({ length: 60 }).notNull(),
    keyHash: char('key_hash', { length: 64 }).notNull().unique(),
    // 'rm_live_a1b2' - enough to recognise a key in the UI, useless as a key.
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('idx_api_keys_user').on(t.userId).where(sql`${t.revokedAt} IS NULL`)],
);

// 3. Accounts ────────────────────────────────────────────────────────────────
// No denormalised current_balance: it desynchronises on the first edit, delete
// or transfer. The balance is computed (PROJECT_SPEC.md 5.1).
export const accounts = pgTable(
  'accounts',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar({ length: 100 }).notNull(),
    type: varchar({ length: 30 }).notNull(),
    currency: char({ length: 3 }).notNull().default('COP'),
    // Default written as SQL, not as 0n: drizzle-kit serialises its snapshot
    // with JSON.stringify, which throws on a BigInt literal.
    initialBalanceMinor: bigint('initial_balance_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    color: varchar({ length: 20 }).notNull().default('#3B82F6'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('uq_accounts_name').on(t.userId, t.name),
    check(
      'accounts_type_check',
      sql`${t.type} IN ('checking','credit_card','savings','cash','digital_wallet')`,
    ),
  ],
);

// 4. Categories ──────────────────────────────────────────────────────────────
export const categories = pgTable(
  'categories',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar({ length: 80 }).notNull(),
    icon: varchar({ length: 50 }).notNull().default('Tag'),
    color: varchar({ length: 20 }).notNull().default('#6B7280'),
    type: varchar({ length: 10 }).notNull(),
    // Honest name: seeded categories are per-user copies, not shared rows.
    createdFromSeed: boolean('created_from_seed').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique('uq_categories').on(t.userId, t.name, t.type),
    index('idx_categories_user').on(t.userId),
    check('categories_type_check', sql`${t.type} IN ('expense','income')`),
  ],
);

// 5. Budgets ─────────────────────────────────────────────────────────────────
// Per period, not a single value on `categories`. A single value rewrote the
// history of previous months every time the user changed it.
export const budgets = pgTable(
  'budgets',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    // First day of the month in the user's timezone, not UTC.
    periodStart: date('period_start').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('uq_budget').on(t.userId, t.categoryId, t.periodStart),
    check('budgets_amount_check', sql`${t.amountMinor} >= 0`),
  ],
);

// 6. Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable(
  'transactions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // SET NULL, not CASCADE: deleting an account must never delete the money
    // that moved through it.
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),

    // NOT NULL with no default on purpose: it forces the caller to resolve it.
    // The service derives it as accounts.currency -> profiles.base_currency,
    // because quick-add from the Shortcut carries no account_id. Without a
    // currency, SUM() silently mixes them.
    currency: char({ length: 3 }).notNull(),

    type: varchar({ length: 10 }).notNull(),
    // pending_auth: a credit authorisation whose amount can still change when
    // it settles (tips, hotels, fuel).
    status: varchar({ length: 20 }).notNull().default('confirmed'),

    merchant: varchar({ length: 255 }).notNull(),
    merchantNormalized: varchar('merchant_normalized', { length: 255 }),
    note: text(),
    transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),

    source: varchar({ length: 30 }).notNull(),
    // Generated by the CLIENT, not a time-window hash. See the partial unique
    // index below: that constraint is the idempotency mechanism.
    idempotencyKey: uuid('idempotency_key'),
    ocrConfidence: numeric('ocr_confidence', { precision: 3, scale: 2 }),

    // Which capture level assigned the category. Feeds the central metric of
    // phase 4: 'rule_engine' is level 1, 'telegram' level 2, 'shortcut_menu' 3.
    categorizedBy: varchar('categorized_by', { length: 20 }),

    // Transfers are two linked legs; one account_id cannot model them.
    transferGroupId: uuid('transfer_group_id'),

    // Key in R2, never a public URL.
    receiptObjectKey: text('receipt_object_key'),
    // Soft delete: this is a money app, nothing is hard deleted.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The idempotency constraint. PARTIAL because manual entries carry no key,
    // and without the WHERE clause every NULL would collide under a plain
    // UNIQUE in Postgres versions that treat NULLs as equal - and more to the
    // point, it keeps the index limited to rows that actually have a key.
    // UNIQUE rather than a plain index: only a constraint makes two concurrent
    // requests collide. A SELECT-then-INSERT is a TOCTOU and inserts both.
    uniqueIndex('idx_tx_idempotency')
      .on(t.userId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),

    index('idx_tx_user_date').on(t.userId, t.transactionDate.desc()).where(sql`${t.deletedAt} IS NULL`),
    index('idx_tx_user_cat').on(t.userId, t.categoryId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_tx_transfer').on(t.transferGroupId).where(sql`${t.transferGroupId} IS NOT NULL`),

    // Duplicate detection is "same amount + merchant + 24h window", so
    // merchant_normalized must be in the index or the query cannot use it.
    index('idx_tx_dedupe')
      .on(t.userId, t.amountMinor, t.merchantNormalized, t.transactionDate)
      .where(sql`${t.deletedAt} IS NULL`),

    // The level-2 queue: what still needs a category.
    index('idx_tx_uncategorized')
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.categoryId} IS NULL AND ${t.deletedAt} IS NULL`),

    check('transactions_amount_check', sql`${t.amountMinor} > 0`),
    check('transactions_type_check', sql`${t.type} IN ('expense','income','transfer')`),
    check(
      'transactions_status_check',
      sql`${t.status} IN ('confirmed','pending_review','pending_auth','declined')`,
    ),
    check('transactions_merchant_check', sql`length(trim(${t.merchant})) > 0`),
    check(
      'transactions_source_check',
      sql`${t.source} IN ('wallet_nfc','sms_shortcut','ocr_screenshot','manual','telegram_text','csv_import')`,
    ),
    check(
      'transactions_categorized_by_check',
      sql`${t.categorizedBy} IN ('rule_engine','telegram','shortcut_menu','manual','ocr')`,
    ),
  ],
);

// 7. Categorization rules ────────────────────────────────────────────────────
export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    merchantPattern: varchar('merchant_pattern', { length: 255 }).notNull(),
    /**
     * Which direction of money this rule is for, mirroring categories.type.
     *
     * WHY IT IS DENORMALISED HERE INSTEAD OF JOINED
     * ---------------------------------------------
     * The unique constraint below is the whole argument. A Postgres unique
     * index cannot reference another table, so without this column the only
     * possible key is (user_id, merchant_pattern) - and then teaching a
     * merchant as income would overwrite the expense rule for the same name.
     * That is not hypothetical here: the Bancolombia parser writes the
     * counterparty's name for both directions of a transfer, so one string
     * legitimately needs one rule each way.
     *
     * It cannot drift: updateCategory never writes `type`, so a category's
     * direction is immutable once created.
     */
    type: varchar({ length: 10 }).notNull(),
    // When true the pattern is user-supplied regex, and it is executed ONLY
    // through node-re2. The native engine backtracks and a crafted pattern
    // blocks the event loop.
    isRegex: boolean('is_regex').notNull().default(false),
    priority: integer().notNull().default(0),
    // How often the rule fired. This is what measures whether level 1 is
    // actually learning.
    hitCount: integer('hit_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    // The engine reads this on EVERY ingestion, ordered by priority.
    index('idx_rules_user').on(t.userId, t.priority.desc()),

    /**
     * The upsert target, and the index the lookup rides on.
     *
     * Learning is an INSERT ... ON CONFLICT DO UPDATE, never a SELECT followed
     * by an INSERT (rule 6): two taps on the same merchant at once must
     * collide on a constraint, not both insert. That needs this to exist.
     *
     * It doubles as the seek for the ingestion path, which is an equality on
     * exactly these three columns, so the engine never joins and never scans.
     */
    // is_regex belongs in the key, not hanging off it: `envio*` stored as a
    // literal and `envio*` stored as a regex are two different rules. Without
    // it the documented ON CONFLICT DO UPDATE would silently overwrite one
    // with the other, turning a literal into a pattern behind the user's back.
    unique('uq_rules_merchant').on(t.userId, t.merchantPattern, t.type, t.isRegex),

    check('categorization_rules_type_check', sql`${t.type} IN ('expense','income')`),
  ],
);

// 8. Achievements ────────────────────────────────────────────────────────────
// P1: these reward behaviour, never amounts or outcomes.
export const achievements = pgTable(
  'achievements',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // 'streak_7d', 'reviewed_statement', 'adjusted_budget'
    code: varchar({ length: 50 }).notNull(),
    // Bounds how often a repeatable achievement can be earned: '2026-W34'
    // weekly, '2026-08' monthly, NULL for genuinely one-off ones.
    periodKey: varchar('period_key', { length: 10 }),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NULLS NOT DISTINCT (PG15+) is the whole point. A plain UNIQUE would let
    // several rows with a NULL period_key escape it, duplicating the one-off
    // achievements; and a UNIQUE (user_id, code) without period_key would make
    // 'streak_7d' winnable once in a lifetime, which contradicts P1: a streak
    // that only counts the first time rewards having started, not consistency.
    unique('uq_achievement').on(t.userId, t.code, t.periodKey).nullsNotDistinct(),
  ],
);

// 9. Ingestion failures ──────────────────────────────────────────────────────
// Without this a failing webhook loses the expense silently, which erodes trust
// in the whole dataset far beyond the one row that was lost.
export const ingestionFailures = pgTable('ingestion_failures', {
  id: primaryId(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  source: varchar({ length: 30 }).notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  error: text().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// 10. Telemetry events ───────────────────────────────────────────────────────
// B9. The table that makes every later performance claim checkable.
//
// WHY IN THIS DATABASE AND NOT IN AN ANALYTICS SERVICE
// ---------------------------------------------------
// Two of the four phase-1 baselines are JOINs against financial data: "days
// with at least one entry / days elapsed" needs `transactions`, and dashboard
// latency is only interpretable next to how many rows that dashboard had to
// read. An external product would hold half of each answer and could not be
// asked the question at all. It would also mean shipping behavioural data
// about someone's spending to a third party, for one user, for free-tier
// analytics nobody is reading yet.
//
// WHY value_scaled IS BIGINT AND NOT double precision
// --------------------------------------------------
// web-vitals reports LCP in fractional milliseconds and CLS as a unitless
// ratio below 1. A float column would store both, at the cost of putting a
// float in a schema whose first rule is that money never uses one - and then
// every reader has to stop and work out whether this column is an exception or
// a mistake. Same trick as core/money.ts instead: a fixed scale of 1000, so
// 2431.7 ms is 2431700 and a CLS of 0.083 is 83. Exact, one type, no exception
// to remember. TELEMETRY_SCALE in core/telemetry.ts is the only place
// that number appears in code.
export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    metric: varchar({ length: 40 }).notNull(),
    valueScaled: bigint('value_scaled', { mode: 'bigint' }).notNull(),
    // web-vitals' own good/needs-improvement/poor verdict. Derivable from the
    // value and the P7 thresholds, but stored because those thresholds are
    // Google's and they move; a rating computed later against 2027 thresholds
    // would silently rewrite what 2026 measured.
    rating: varchar({ length: 20 }),
    route: text(),
    metadata: jsonb(),
    // Server time on purpose. sendBeacon fires as the tab goes away and can
    // arrive seconds late, but a client-supplied timestamp is a clock this app
    // does not control, and a skewed one would land rows in the wrong day of
    // the daily-usage baseline.
    createdAt: createdAt(),
  },
  (t) => [
    // The shape of every baseline query: one user, one metric, over a window.
    index('idx_telemetry_user_metric_time').on(t.userId, t.metric, t.createdAt.desc()),
    check(
      'telemetry_metric_check',
      sql`${t.metric} IN ('LCP','INP','CLS','FCP','TTFB','manual_entry_duration','dashboard_query_duration')`,
    ),
    // A negative duration means a broken clock, not a fast page. Rejecting it
    // at the constraint keeps it out of the percentiles instead of making
    // someone explain an impossible p50 months later.
    check('telemetry_value_check', sql`${t.valueScaled} >= 0`),
    check(
      'telemetry_rating_check',
      sql`${t.rating} IS NULL OR ${t.rating} IN ('good','needs-improvement','poor')`,
    ),
  ],
);
