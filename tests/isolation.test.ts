/**
 * Tenant isolation against a real Postgres (IMPLEMENTATION_PLAN.md section 11.3).
 *
 * WHY THIS EXISTS WHEN repositories.test.ts ALREADY PASSES
 * -------------------------------------------------------
 * That suite mocks `getDb` and asserts that a WHERE clause was built. It proves
 * the code intends to filter by userId. It cannot prove the filter works,
 * because no query is ever executed: a repository that built a perfectly shaped
 * WHERE against the wrong column would pass every one of those tests.
 *
 * Multi-tenant isolation is the security property this whole architecture is
 * arranged around - CLAUDE.md calls the repository layer the primary barrier
 * and RLS merely defence in depth. A property that important cannot rest on a
 * test that never touches a database.
 *
 * HOW TO RUN IT
 * -------------
 * Never against the app's own database. It writes rows.
 *
 *   neon branches create --name test-isolation --parent main
 *   TEST_DATABASE_URL='<pooled connection string of that branch>' pnpm test:isolation
 *
 * The branch must have the migrations applied (`pnpm db:migrate` pointed at it).
 * Without TEST_DATABASE_URL the suite skips, so `pnpm test` stays offline and
 * fast - and prints why, because a silently skipped security test is worse than
 * no security test.
 */
import { readFileSync } from 'node:fs';

import { parse as parseEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DB_URL = process.env.TEST_DATABASE_URL?.trim();

/**
 * Reduces a connection string to what actually identifies a database: host and
 * database name, with Neon's "-pooler" suffix removed.
 *
 * Comparing the raw strings is not enough. The same database has a pooled and a
 * direct endpoint, and can be reached with different roles and passwords, so
 * two strings that differ character by character routinely address exactly the
 * same rows.
 */
function databaseIdentity(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace('-pooler', '')}${parsed.pathname}`;
}

/**
 * The app's own database, from the environment or from .env.local.
 *
 * Parsed rather than loaded: dotenv's config() would inject DATABASE_URL into
 * process.env, and this file then overwrites that variable to point the
 * repositories at the test database. Reading without injecting keeps those two
 * concerns from touching.
 */
function appDatabaseUrl(): string | null {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  try {
    return parseEnv(readFileSync('.env.local', 'utf-8')).DATABASE_URL?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * FAIL CLOSED.
 *
 * The first version of this guard compared TEST_DATABASE_URL against
 * process.env.DATABASE_URL - which vitest never populates, because it does not
 * read .env.local. The comparison was therefore between a string and undefined,
 * it never matched, and the suite happily wrote rows into the production
 * database on its first run. The rows were removed by afterAll, but that was
 * luck: any failure before the teardown would have left them there.
 *
 * The lesson is in the shape of the check, not the value: a safety guard that
 * cannot establish what it is protecting must refuse, never assume the best.
 */
if (TEST_DB_URL) {
  const appUrl = appDatabaseUrl();

  if (!appUrl) {
    throw new Error(
      'Refusing to run the isolation suite: DATABASE_URL could not be resolved ' +
        'from the environment or .env.local, so there is no way to prove ' +
        'TEST_DATABASE_URL is not the app database. Set DATABASE_URL too.',
    );
  }

  if (databaseIdentity(TEST_DB_URL) === databaseIdentity(appUrl)) {
    throw new Error(
      'Refusing to run the isolation suite: TEST_DATABASE_URL addresses the same ' +
        'host and database as DATABASE_URL. This suite writes rows and must run ' +
        'against a throwaway Neon branch, never the app database.',
    );
  }

  // Set only after both checks pass. getDb() reads DATABASE_URL lazily on its
  // first call and memoises it, and that first call happens inside a test.
  process.env.DATABASE_URL = TEST_DB_URL;
}

const enabled = Boolean(TEST_DB_URL);

if (!TEST_DB_URL) {
  console.warn(
    '\n[isolation] SKIPPED - TEST_DATABASE_URL is not set.\n' +
      '[isolation] The tenant-isolation gate did NOT run. See the header of ' +
      'tests/isolation.test.ts.\n',
  );
}

const suite = enabled ? describe : describe.skip;

// Neon cold-starts at up to ~2.6s p95, and this suite opens with a burst of
// writes. A default 5s timeout would fail on a sleeping branch rather than on
// anything being wrong.
const TIMEOUT = 60_000;

suite('Tenant isolation against a real database', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let repos: any;
  let types: any;
  let db: any;
  let schema: any;

  const userA = '1a1a1a1a-1111-4111-8111-1a1a1a1a1a1a';
  const userB = '2b2b2b2b-2222-4222-8222-2b2b2b2b2b2b';

  // Everything user B owns, captured at setup so each assertion can ask the
  // pointed question: "can A reach THIS row?"
  const owned: Record<string, any> = {};

  beforeAll(async () => {
    repos = await import('@/core/repositories');
    types = await import('@/core/types');
    schema = await import('@/infrastructure/db/schema');
    const client = await import('@/infrastructure/db/client');
    db = client.getDb();

    await cleanup();

    for (const [id, email] of [
      [userA, 'a@example.com'],
      [userB, 'b@example.com'],
    ] as const) {
      await repos.upsertProfile(types.toUserId(id), { email });
    }

    const uid = types.toUserId(userB);

    owned.account = await repos.createAccount(uid, {
      name: 'B checking',
      type: 'checking',
      initialBalanceMinor: 1_000_00n,
    });
    owned.category = await repos.createCategory(uid, { name: 'B food', type: 'expense' });
    owned.transaction = (
      await repos.createTransaction(uid, {
        accountId: types.toAccountId(owned.account.id),
        categoryId: types.toCategoryId(owned.category.id),
        amountMinor: 4_500_000n,
        currency: 'COP',
        type: 'expense',
        merchant: 'B merchant',
        transactionDate: new Date(),
        source: 'manual',
        categorizedBy: 'manual',
      })
    ).transaction;
    owned.budget = await repos.upsertBudget(uid, {
      categoryId: types.toCategoryId(owned.category.id),
      periodStart: '2026-08-01',
      amountMinor: 500_000n,
    });
    owned.rule = await repos.createRule(uid, {
      categoryId: types.toCategoryId(owned.category.id),
      merchantPattern: 'b-merchant',
    });
    owned.apiKey = await repos.createApiKey(uid, {
      name: 'B key',
      keyHash: 'b'.repeat(64),
      keyPrefix: 'rm_bbbb',
    });
    owned.achievement = (await repos.grantAchievement(uid, 'streak_7d', '2026-08')).achievement;
    owned.failure = await repos.recordIngestionFailure({
      userId: uid,
      source: 'manual',
      rawPayload: { secret: 'B payload' },
      error: 'B error',
    });
  }, TIMEOUT);

  afterAll(async () => {
    await cleanup();
  }, TIMEOUT);

  /**
   * Deletes both profiles. Every other table cascades from profiles, so this is
   * the whole teardown - and it is also run before setup, so a crashed previous
   * run cannot leave rows that make the next one pass for the wrong reason.
   */
  async function cleanup(): Promise<void> {
    if (!db) return;
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.profiles).where(inArray(schema.profiles.id, [userA, userB]));
  }

  describe('A cannot read anything belonging to B', () => {
    it('list queries return only the caller’s own rows', async () => {
      const a = types.toUserId(userA);

      expect(await repos.listAccounts(a)).toEqual([]);
      expect(await repos.listCategories(a)).toEqual([]);
      expect(await repos.listTransactions(a)).toEqual([]);
      expect(await repos.listBudgetsForPeriod(a, '2026-08-01')).toEqual([]);
      expect(await repos.listRules(a)).toEqual([]);
      expect(await repos.listApiKeys(a)).toEqual([]);
      expect(await repos.listAchievements(a)).toEqual([]);
      expect(await repos.listIngestionFailures(a)).toEqual([]);
      expect(await repos.getUncategorizedTransactions(a)).toEqual([]);
      expect(await repos.getRecentEnrichedTransactions(a, 50)).toEqual([]);
    }, TIMEOUT);

    it('get-by-id returns null for a row owned by the other user', async () => {
      // The dangerous shape: A has a valid id (leaked, guessed, or from a
      // shared link) and asks for it. The id alone must never be enough.
      const a = types.toUserId(userA);

      expect(await repos.getAccount(a, types.toAccountId(owned.account.id))).toBeNull();
      expect(await repos.getCategory(a, types.toCategoryId(owned.category.id))).toBeNull();
      expect(
        await repos.getTransaction(a, types.toTransactionId(owned.transaction.id)),
      ).toBeNull();
      expect(
        await repos.getAccountBalance(a, types.toAccountId(owned.account.id)),
      ).toBeNull();
    }, TIMEOUT);

    it('aggregations do not sum the other user’s money', async () => {
      // The subtlest leak, because it returns a number rather than a row: an
      // aggregate missing its tenant filter looks like a working dashboard.
      const a = types.toUserId(userA);

      const totals = await repos.getMonthlyTotals(
        a,
        'America/Bogota',
        '2020-01-01 00:00:00',
        '2100-01-01 00:00:00',
      );
      expect(totals.totalExpenseMinor).toBe(0n);
      expect(totals.totalIncomeMinor).toBe(0n);
      expect(totals.transactionCount).toBe(0);

      const breakdown = await repos.getCategorySpendingBreakdown(
        a,
        'America/Bogota',
        '2020-01-01 00:00:00',
        '2100-01-01 00:00:00',
      );
      expect(breakdown).toEqual([]);
    }, TIMEOUT);

    it('telemetry percentiles and usage are per tenant', async () => {
      const telemetry = await import('@/core/repositories/telemetry.repository');
      const a = types.toUserId(userA);
      const b = types.toUserId(userB);

      await telemetry.recordTelemetryEvent(b, {
        metric: 'LCP',
        valueScaled: 2_431_700n,
      });

      const forA = await telemetry.getMetricPercentiles(a, 'LCP');
      expect(forA.n).toBe(0);
      expect(forA.p50Scaled).toBeNull();

      const forB = await telemetry.getMetricPercentiles(b, 'LCP');
      expect(forB.n).toBe(1);

      // Guards the CASE that replaced COALESCE(GREATEST(...)): a user with no
      // transactions must report 0/0, not a fabricated 0/1.
      const usageA = await telemetry.getDailyUsage(a, 'America/Bogota');
      expect(usageA).toEqual({ daysWithEntry: 0, daysElapsed: 0 });

      const usageB = await telemetry.getDailyUsage(b, 'America/Bogota');
      expect(usageB.daysWithEntry).toBe(1);
      expect(usageB.daysElapsed).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);
  });

  describe('A cannot write to anything belonging to B', () => {
    it('updates addressed at the other user’s rows change nothing', async () => {
      const a = types.toUserId(userA);

      expect(
        await repos.updateAccount(a, types.toAccountId(owned.account.id), {
          name: 'hijacked',
        }),
      ).toBeNull();
      expect(
        await repos.updateCategory(a, types.toCategoryId(owned.category.id), {
          name: 'hijacked',
        }),
      ).toBeNull();
      expect(
        await repos.updateTransaction(a, types.toTransactionId(owned.transaction.id), {
          amountMinor: 1n,
        }),
      ).toBeNull();
      expect(
        await repos.updateRule(a, types.toRuleId(owned.rule.id), {
          merchantPattern: 'hijacked',
        }),
      ).toBeNull();

      // And the rows are genuinely untouched, not merely reported as such.
      const b = types.toUserId(userB);
      expect((await repos.getAccount(b, types.toAccountId(owned.account.id))).name).toBe(
        'B checking',
      );
      expect(
        (await repos.getTransaction(b, types.toTransactionId(owned.transaction.id)))
          .amountMinor,
      ).toBe(4_500_000n);
    }, TIMEOUT);

    it('deletes addressed at the other user’s rows delete nothing', async () => {
      const a = types.toUserId(userA);

      expect(await repos.deleteBudget(a, types.toBudgetId(owned.budget.id))).toBe(false);
      expect(await repos.deleteRule(a, types.toRuleId(owned.rule.id))).toBe(false);
      expect(await repos.revokeApiKey(a, types.toApiKeyId(owned.apiKey.id))).toBe(false);
      expect(
        await repos.resolveIngestionFailure(
          a,
          types.toIngestionFailureId(owned.failure.id),
        ),
      ).toBe(false);
      expect(
        await repos.softDeleteTransaction(
          a,
          types.toTransactionId(owned.transaction.id),
        ),
      ).toBe(false);

      const b = types.toUserId(userB);
      expect(await repos.listBudgetsForPeriod(b, '2026-08-01')).toHaveLength(1);
      expect(await repos.listRules(b)).toHaveLength(1);
      expect(await repos.listApiKeys(b)).toHaveLength(1);
      expect(await repos.listIngestionFailures(b)).toHaveLength(1);
      expect(await repos.listTransactions(b)).toHaveLength(1);
    }, TIMEOUT);
  });

  describe('B still sees everything B owns', () => {
    it('is not isolated from itself', async () => {
      // The failure mode this catches: a filter so aggressive it returns
      // nothing for anyone would pass every assertion above.
      const b = types.toUserId(userB);

      expect(await repos.listAccounts(b)).toHaveLength(1);
      expect(await repos.listCategories(b)).toHaveLength(1);
      expect(await repos.listTransactions(b)).toHaveLength(1);
      expect(await repos.listAchievements(b)).toHaveLength(1);
      expect(
        await repos.getAccount(b, types.toAccountId(owned.account.id)),
      ).not.toBeNull();

      const totals = await repos.getMonthlyTotals(
        b,
        'America/Bogota',
        '2020-01-01 00:00:00',
        '2100-01-01 00:00:00',
      );
      expect(totals.totalExpenseMinor).toBe(4_500_000n);
    }, TIMEOUT);
  });

  describe('the lookups that deliberately take no userId', () => {
    it('resolve the owner instead of trusting a caller-supplied one', async () => {
      // verifyAndTouchApiKey and getProfileByTelegramChatId are the two
      // functions without a userId parameter, because they are the entry points
      // that DISCOVER the tenant. They must return B's id from B's secret - and
      // nothing at all from a wrong one.
      const found = await repos.verifyAndTouchApiKey('b'.repeat(64));
      expect(found?.userId).toBe(userB);

      expect(await repos.verifyAndTouchApiKey('c'.repeat(64))).toBeNull();
      expect(await repos.getProfileByTelegramChatId(999_999_999n)).toBeNull();
    }, TIMEOUT);
  });
});
