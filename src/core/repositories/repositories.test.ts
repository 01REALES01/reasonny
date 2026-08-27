import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAccount,
  getAccount,
  getAccountBalance,
  listAccounts,
} from './account.repository';
import { grantAchievement, listAchievements } from './achievement.repository';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifyAndTouchApiKey,
} from './api-key.repository';
import {
  deleteBudget,
  listBudgetsForPeriod,
  upsertBudget,
} from './budget.repository';
import {
  createRule,
  deleteRule,
  incrementRuleHitCount,
  listRules,
  updateRule,
} from './categorization-rule.repository';
import {
  createCategory,
  getCategory,
  listCategories,
  seedDefaultCategories,
} from './category.repository';
import {
  listIngestionFailures,
  recordIngestionFailure,
  resolveIngestionFailure,
} from './ingestion-failure.repository';
import {
  getProfile,
  getProfileByTelegramChatId,
  updateTelegramChatId,
  upsertProfile,
} from './profile.repository';
import {
  createTransaction,
  getUncategorizedTransactions,
  listTransactions,
  softDeleteTransaction,
} from './transaction.repository';
import {
  toAccountId,
  toApiKeyId,
  toBudgetId,
  toCategoryId,
  toIngestionFailureId,
  toRuleId,
  toTransactionId,
  toUserId,
} from '../types';

// Mock getDb from infrastructure/db/client
vi.mock('@/infrastructure/db/client', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    getDb: vi.fn(() => mockDb),
  };
});

import { getDb } from '@/infrastructure/db/client';

describe('Repository Layer Unit Tests', () => {
  const userId = toUserId('11111111-1111-1111-1111-111111111111');
  const accountId = toAccountId('22222222-2222-2222-2222-222222222222');
  const categoryId = toCategoryId('33333333-3333-3333-3333-333333333333');
  const transactionId = toTransactionId('44444444-4444-4444-4444-444444444444');
  const apiKeyId = toApiKeyId('55555555-5555-5555-5555-555555555555');
  const budgetId = toBudgetId('66666666-6666-6666-6666-666666666666');
  const ruleId = toRuleId('77777777-7777-7777-7777-777777777777');
  const failureId = toIngestionFailureId('88888888-8888-8888-8888-888888888888');

  let mockDb: ReturnType<typeof getDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = getDb();
  });

  describe('Profile Repository', () => {
    it('getProfile fetches profile for specific userId', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: userId, email: 'user@example.com' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const profile = await getProfile(userId);
      expect(profile).toEqual({ id: userId, email: 'user@example.com' });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('upsertProfile performs insert with onConflictDoUpdate', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: userId, email: 'user@example.com' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const result = await upsertProfile(userId, { email: 'user@example.com' });
      expect(result.email).toBe('user@example.com');
    });

    it('updateTelegramChatId updates telegramChatId for user', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: userId, telegramChatId: 123456n }]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      const result = await updateTelegramChatId(userId, 123456n);
      expect(result?.telegramChatId).toBe(123456n);
    });

    it('getProfileByTelegramChatId searches by chat ID without userId', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: userId, telegramChatId: 123456n }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const result = await getProfileByTelegramChatId(123456n);
      expect(result?.id).toBe(userId);
    });
  });

  describe('Account Repository', () => {
    it('listAccounts filters by userId and archived status', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: accountId, name: 'Main Checking' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const accounts = await listAccounts(userId);
      expect(accounts).toHaveLength(1);
    });

    it('getAccount returns single account', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: accountId, name: 'Main Checking' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const acc = await getAccount(userId, accountId);
      expect(acc?.id).toBe(accountId);
    });

    it('createAccount inserts account with userId', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: accountId, name: 'Savings' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const acc = await createAccount(userId, {
        name: 'Savings',
        type: 'savings',
      });
      expect(acc.name).toBe('Savings');
    });

    it('getAccountBalance executes left join with balance formula', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ currency: 'COP', balanceMinor: 500000n }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const balance = await getAccountBalance(userId, accountId);
      expect(balance).toEqual({ currency: 'COP', balanceMinor: 500000n });
    });
  });

  describe('Category Repository', () => {
    it('listCategories returns categories for user', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Supermercado' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const categories = await listCategories(userId);
      expect(categories).toHaveLength(1);
    });

    it('getCategory returns single category', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Supermercado' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const category = await getCategory(userId, categoryId);
      expect(category?.id).toBe(categoryId);
    });

    it('createCategory inserts category', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Food' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const cat = await createCategory(userId, { name: 'Food', type: 'expense' });
      expect(cat.name).toBe('Food');
    });

    it('seedDefaultCategories inserts default seed categories', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Supermercado' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const seeded = await seedDefaultCategories(userId);
      expect(seeded).toHaveLength(1);
    });
  });

  describe('Transaction Repository', () => {
    it('createTransaction inserts transaction and reports duplicate status', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: transactionId, amountMinor: 1200000n, merchant: 'Juan Valdez' },
        ]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const { transaction, isDuplicate } = await createTransaction(userId, {
        amountMinor: 1200000n,
        currency: 'COP',
        type: 'expense',
        merchant: 'Juan Valdez',
        source: 'manual',
        transactionDate: new Date(),
      });

      expect(transaction.id).toBe(transactionId);
      expect(isDuplicate).toBe(false);
    });

    it('listTransactions returns list with filters', async () => {
      const mockResult = [{ id: transactionId }];
      const mockChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve(mockResult),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const txs = await listTransactions(userId, { limit: 10, offset: 0 });
      expect(txs).toHaveLength(1);
    });

    it('softDeleteTransaction sets deletedAt timestamp', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: transactionId }]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      const success = await softDeleteTransaction(userId, transactionId);
      expect(success).toBe(true);
    });

    it('getUncategorizedTransactions fetches uncategorized transactions', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: transactionId, categoryId: null }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const txs = await getUncategorizedTransactions(userId);
      expect(txs).toHaveLength(1);
    });
  });

  describe('API Key Repository', () => {
    it('listApiKeys returns non-revoked keys', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: apiKeyId, name: 'iOS Shortcut' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const keys = await listApiKeys(userId);
      expect(keys).toHaveLength(1);
    });

    it('createApiKey inserts hashed key', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: apiKeyId, name: 'iOS Shortcut' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const key = await createApiKey(userId, {
        name: 'iOS Shortcut',
        keyHash: 'a'.repeat(64),
        keyPrefix: 'rm_live_1234',
      });
      expect(key.id).toBe(apiKeyId);
    });

    it('verifyAndTouchApiKey touches lastUsedAt and returns userId', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: apiKeyId, userId }]),
      };
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      (mockDb.select as any).mockReturnValue(mockSelectChain);
      (mockDb.update as any).mockReturnValue(mockUpdateChain);

      const result = await verifyAndTouchApiKey('a'.repeat(64));
      expect(result?.userId).toBe(userId);
      expect(result?.keyId).toBe(apiKeyId);
    });

    it('revokeApiKey sets revokedAt timestamp', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: apiKeyId }]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      const revoked = await revokeApiKey(userId, apiKeyId);
      expect(revoked).toBe(true);
    });
  });

  describe('Budget Repository', () => {
    it('listBudgetsForPeriod fetches budgets for month', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: budgetId, periodStart: '2026-08-01' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const budgets = await listBudgetsForPeriod(userId, '2026-08-01');
      expect(budgets).toHaveLength(1);
    });

    it('upsertBudget inserts or updates budget amount', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: budgetId, amountMinor: 40000000n }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const b = await upsertBudget(userId, {
        categoryId,
        periodStart: '2026-08-01',
        amountMinor: 40000000n,
      });
      expect(b.amountMinor).toBe(40000000n);
    });

    it('deleteBudget removes budget for user', async () => {
      const mockChain = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: budgetId }]),
      };
      (mockDb.delete as any).mockReturnValue(mockChain);

      const deleted = await deleteBudget(userId, budgetId);
      expect(deleted).toBe(true);
    });
  });

  describe('Categorization Rule Repository', () => {
    it('listRules fetches ordered rules', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: ruleId, merchantPattern: 'Exito' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const rules = await listRules(userId);
      expect(rules).toHaveLength(1);
    });

    it('createRule creates rule with default priority', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: ruleId, merchantPattern: 'Exito' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const rule = await createRule(userId, {
        categoryId,
        merchantPattern: 'Exito',
      });
      expect(rule.merchantPattern).toBe('Exito');
    });

    it('updateRule modifies rule fields', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: ruleId, merchantPattern: 'Exito Express' }]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      const updated = await updateRule(userId, ruleId, { merchantPattern: 'Exito Express' });
      expect(updated?.merchantPattern).toBe('Exito Express');
    });

    it('deleteRule deletes rule for user', async () => {
      const mockChain = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: ruleId }]),
      };
      (mockDb.delete as any).mockReturnValue(mockChain);

      const deleted = await deleteRule(userId, ruleId);
      expect(deleted).toBe(true);
    });

    it('incrementRuleHitCount increments hit_count', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      await incrementRuleHitCount(userId, ruleId);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('Achievement Repository', () => {
    it('listAchievements fetches achievements ordered by earnedAt', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ code: 'streak_7d' }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const achievements = await listAchievements(userId);
      expect(achievements).toHaveLength(1);
    });

    it('grantAchievement grants achievement with onConflictDoNothing', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ code: 'streak_7d' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const { achievement, newlyEarned } = await grantAchievement(userId, 'streak_7d');
      expect(achievement?.code).toBe('streak_7d');
      expect(newlyEarned).toBe(true);
    });
  });

  describe('Ingestion Failure Repository', () => {
    it('recordIngestionFailure records payload and error', async () => {
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: failureId, source: 'shortcut' }]),
      };
      (mockDb.insert as any).mockReturnValue(mockChain);

      const failure = await recordIngestionFailure({
        userId,
        source: 'shortcut',
        rawPayload: { amount: 12000 },
        error: 'Invalid format',
      });
      expect(failure.id).toBe(failureId);
    });

    it('listIngestionFailures returns failures for user', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: failureId }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      const failures = await listIngestionFailures(userId);
      expect(failures).toHaveLength(1);
    });

    it('resolveIngestionFailure sets resolvedAt', async () => {
      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: failureId }]),
      };
      (mockDb.update as any).mockReturnValue(mockChain);

      const resolved = await resolveIngestionFailure(userId, failureId);
      expect(resolved).toBe(true);
    });
  });
});
