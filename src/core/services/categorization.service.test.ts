import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/categorization-rule.repository', () => ({
  findRuleForMerchant: vi.fn(),
  learnRule: vi.fn(),
  recordRuleHit: vi.fn(),
}));

vi.mock('@/core/repositories/category.repository', () => ({
  getCategory: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  updateTransaction: vi.fn(),
}));

import { getCategory } from '@/core/repositories/category.repository';
import {
  findRuleForMerchant,
  learnRule,
  recordRuleHit,
} from '@/core/repositories/categorization-rule.repository';
import { updateTransaction } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';

import {
  categorizeTransaction,
  confirmSuggestionUsed,
  learnFromTransaction,
  suggestCategory,
} from './categorization.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const TX_ID = '66666666-6666-4666-8666-666666666666';

describe('the rule engine', () => {
  const userId = toUserId(USER_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('suggestCategory', () => {
    it('looks the merchant up under the SAME key the transaction stores', async () => {
      vi.mocked(findRuleForMerchant).mockResolvedValue({
        ruleId: 'rule-1',
        categoryId: CATEGORY_ID as never,
        categoryName: 'Restaurantes',
        categoryIcon: 'Utensils',
      });

      // Accents, case and double spaces: one shop written by a person in /nuevo
      // and by a bank in an SMS has to reach the engine as one key.
      const result = await suggestCategory(userId, '  Café  JUAN Valdez ', 'expense');

      expect(findRuleForMerchant).toHaveBeenCalledWith(userId, 'cafe juan valdez', 'expense');
      expect(result).toEqual({
        ruleId: 'rule-1',
        categoryId: CATEGORY_ID,
        categoryName: 'Restaurantes',
        categoryIcon: 'Utensils',
      });
    });

    it('answers nothing when no rule has been learned', async () => {
      vi.mocked(findRuleForMerchant).mockResolvedValue(null);

      await expect(suggestCategory(userId, 'Tienda Nueva', 'expense')).resolves.toBeNull();
    });

    it('does not look up a transfer, which has no direction to file', async () => {
      await expect(suggestCategory(userId, 'Juan Valdez', 'transfer')).resolves.toBeNull();
      expect(findRuleForMerchant).not.toHaveBeenCalled();
    });

    it('does not look up a placeholder, so a rule stored before the guard stops firing', async () => {
      await expect(suggestCategory(userId, 'Transferencia enviada', 'expense')).resolves.toBeNull();
      expect(findRuleForMerchant).not.toHaveBeenCalled();
    });

    it('does not look up a merchant that normalises to no key at all', async () => {
      await expect(suggestCategory(userId, '   ', 'expense')).resolves.toBeNull();
      expect(findRuleForMerchant).not.toHaveBeenCalled();
    });
  });

  describe('confirmSuggestionUsed', () => {
    it('counts the firing', async () => {
      await confirmSuggestionUsed(userId, {
        ruleId: 'rule-1',
        categoryId: CATEGORY_ID as never,
        categoryName: 'Restaurantes',
        categoryIcon: 'Utensils',
      });

      expect(recordRuleHit).toHaveBeenCalledWith(userId, 'rule-1');
    });

    it('swallows a counter failure, because a counter is not the transaction', async () => {
      vi.mocked(recordRuleHit).mockRejectedValue(new Error('connection terminated'));

      await expect(
        confirmSuggestionUsed(userId, {
        ruleId: 'rule-1',
        categoryId: CATEGORY_ID as never,
        categoryName: 'Restaurantes',
        categoryIcon: 'Utensils',
      }),
      ).resolves.toBeUndefined();
    });
  });

  describe('categorizeTransaction', () => {
    function updatedRow(overrides = {}) {
      return {
        id: TX_ID,
        type: 'expense',
        merchantNormalized: 'juan valdez',
        categoryId: CATEGORY_ID,
        ...overrides,
      } as never;
    }

    it('writes the category and learns the merchant in one act', async () => {
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);
      vi.mocked(updateTransaction).mockResolvedValue(updatedRow());

      const result = await categorizeTransaction(userId, TX_ID, CATEGORY_ID);

      expect(result).toMatchObject({ ok: true, learned: true });
      expect(learnRule).toHaveBeenCalledWith(userId, {
        merchantPattern: 'juan valdez',
        categoryId: CATEGORY_ID,
        type: 'expense',
      });
    });

    it("refuses another tenant's category before touching the transaction", async () => {
      vi.mocked(getCategory).mockResolvedValue(null);

      const result = await categorizeTransaction(userId, TX_ID, CATEGORY_ID);

      expect(result).toEqual({ ok: false, reason: 'unknown_category' });
      expect(updateTransaction).not.toHaveBeenCalled();
      expect(learnRule).not.toHaveBeenCalled();
    });

    it('answers a malformed category id instead of throwing', async () => {
      const result = await categorizeTransaction(userId, TX_ID, 'not-a-uuid');

      expect(result).toEqual({ ok: false, reason: 'unknown_category' });
      expect(getCategory).not.toHaveBeenCalled();
    });

    it('reports a transaction that is not there', async () => {
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);
      vi.mocked(updateTransaction).mockResolvedValue(null);

      const result = await categorizeTransaction(userId, TX_ID, CATEGORY_ID);

      expect(result).toEqual({ ok: false, reason: 'not_found' });
      expect(learnRule).not.toHaveBeenCalled();
    });

    it('still saves the correction when the rule cannot be written', async () => {
      // The user's statement is the thing that mattered. The rule is next
      // time's optimisation, and losing it is not an error on screen.
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);
      vi.mocked(updateTransaction).mockResolvedValue(updatedRow());
      vi.mocked(learnRule).mockRejectedValue(new Error('deadlock detected'));

      const result = await categorizeTransaction(userId, TX_ID, CATEGORY_ID);

      expect(result).toMatchObject({ ok: true, learned: false });
    });
  });

  describe('learnFromTransaction', () => {
    it('files nothing for a placeholder the SMS parser invented', async () => {
      // "Transferencia enviada" is what Bancolombia's parser writes when the
      // message carries no counterparty. Learning from it would file every
      // future unnamed transfer under this category, silently.
      const learned = await learnFromTransaction(userId, {
        type: 'expense',
        merchantNormalized: 'transferencia enviada',
        categoryId: CATEGORY_ID,
      } as never);

      expect(learned).toBe(false);
      expect(learnRule).not.toHaveBeenCalled();
    });

    it('files nothing for a masked account number', async () => {
      const learned = await learnFromTransaction(userId, {
        type: 'expense',
        merchantNormalized: 'cuenta ••9149',
        categoryId: CATEGORY_ID,
      } as never);

      expect(learned).toBe(false);
    });

    it('files nothing for a transfer', async () => {
      const learned = await learnFromTransaction(userId, {
        type: 'transfer',
        merchantNormalized: 'traslado',
        categoryId: CATEGORY_ID,
      } as never);

      expect(learned).toBe(false);
      expect(learnRule).not.toHaveBeenCalled();
    });

    it('files nothing for a row with no merchant key', async () => {
      const learned = await learnFromTransaction(userId, {
        type: 'expense',
        merchantNormalized: null,
        categoryId: CATEGORY_ID,
      } as never);

      expect(learned).toBe(false);
      expect(learnRule).not.toHaveBeenCalled();
    });

    it('files nothing when the category was cleared', async () => {
      const learned = await learnFromTransaction(userId, {
        type: 'expense',
        merchantNormalized: 'juan valdez',
        categoryId: null,
      } as never);

      expect(learned).toBe(false);
      expect(learnRule).not.toHaveBeenCalled();
    });
  });
});
