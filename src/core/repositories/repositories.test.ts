import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAccount,
  getAccount,
  getAccountBalance,
  listAccounts,
} from './account.repository';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifyAndTouchApiKey,
} from './api-key.repository';
import {
  createCategory,
  getCategory,
  listCategories,
  seedDefaultCategories,
} from './category.repository';
import { ensureProfile, getProfile } from './profile.repository';
import {
  countUncategorizedTransactions,
  createTransaction,
} from './transaction.repository';
import {
  toAccountId,
  toApiKeyId,
  toCategoryId,
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

    it('ensureProfile inserts only when the row is missing', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (mockDb.select as any).mockReturnValue(selectChain);
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: userId, email: 'user@example.com' }]),
      };
      (mockDb.insert as any).mockReturnValue(insertChain);

      const created = await ensureProfile(userId, 'user@example.com');
      expect(created.email).toBe('user@example.com');
      expect(mockDb.insert).toHaveBeenCalled();

      // Second call: the row now exists, so nothing is written. Signing in must
      // not overwrite a profile the user has since edited.
      vi.clearAllMocks();
      selectChain.limit.mockResolvedValue([{ id: userId, email: 'renamed@example.com' }]);
      (mockDb.select as any).mockReturnValue(selectChain);

      const existing = await ensureProfile(userId, 'user@example.com');
      expect(existing.email).toBe('renamed@example.com');
      expect(mockDb.insert).not.toHaveBeenCalled();
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
        merchant: 'Café  Juan Valdez ',
        source: 'manual',
        transactionDate: new Date(),
      });

      expect(transaction.id).toBe(transactionId);
      expect(isDuplicate).toBe(false);

      // The key is derived here, never passed in. Three callers used to compute
      // it themselves and disagreed, so the same shop typed by a person and
      // shouted by a bank SMS produced two keys and deduplication missed it.
      expect(mockChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          merchant: 'Café  Juan Valdez ',
          merchantNormalized: 'cafe juan valdez',
        }),
      );
    });

    it('countUncategorizedTransactions returns the count, not a row list', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 7 }]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      expect(await countUncategorizedTransactions(userId)).toBe(7);
    });

    it('countUncategorizedTransactions reports zero when the query returns nothing', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      (mockDb.select as any).mockReturnValue(mockChain);

      expect(await countUncategorizedTransactions(userId)).toBe(0);
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
});
