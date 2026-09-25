import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/account.repository', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  findOrCreateBankAccount: vi.fn(),
  getAccount: vi.fn(),
}));

vi.mock('@/core/repositories/category.repository', () => ({
  getCategory: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  createTransaction: vi.fn(),
}));

vi.mock('@/core/services/categorization.service', () => ({
  suggestCategory: vi.fn(),
  confirmSuggestionUsed: vi.fn(),
}));

import {
  createAccount,
  findOrCreateBankAccount,
  getAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getCategory } from '@/core/repositories/category.repository';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import { createTransaction } from '@/core/repositories/transaction.repository';
import {
  confirmSuggestionUsed,
  suggestCategory,
} from '@/core/services/categorization.service';
import { toUserId } from '@/core/types';

import { recordTransaction } from './transaction.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

function profileFixture(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: USER_ID,
    email: 'jp@example.com',
    fullName: null,
    baseCurrency: 'COP',
    timezone: 'America/Bogota',
    telegramChatId: null,
    locationEnabled: false,
    homeLatitude: null,
    homeLongitude: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  } as ProfileRow;
}

/** The minimum a caller must supply; every test varies only what it is about. */
function baseInput() {
  return {
    amountMinor: 1_200_000n,
    type: 'expense' as const,
    merchant: 'Juan Valdez',
    transactionDate: new Date('2026-09-16T15:00:00Z'),
    source: 'manual' as const,
    locationSource: 'device_pwa' as const,
  };
}

/** What createTransaction was called with, for the one call it received. */
function writtenInput() {
  return vi.mocked(createTransaction).mock.calls[0]?.[1];
}

describe('recordTransaction', () => {
  const userId = toUserId(USER_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suggestCategory).mockResolvedValue(null);
    vi.mocked(createTransaction).mockResolvedValue({
      transaction: { id: 'tx-1' } as never,
      isDuplicate: false,
    });
  });

  describe('account resolution', () => {
    it('uses the first non-archived account and its currency when none is named', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'USD' } as never,
      ]);

      const result = await recordTransaction(userId, profileFixture(), baseInput());

      expect(result.ok).toBe(true);
      expect(writtenInput()?.accountId).toBe(ACCOUNT_ID);
      // The account's currency, not the profile's base: the account is what the
      // money actually sits in.
      expect(writtenInput()?.currency).toBe('USD');
      expect(createAccount).not.toHaveBeenCalled();
    });

    it('creates a cash account in the base currency on the very first transaction', async () => {
      vi.mocked(listAccounts).mockResolvedValue([]);
      vi.mocked(createAccount).mockResolvedValue({
        id: ACCOUNT_ID,
        currency: 'COP',
      } as never);

      await recordTransaction(userId, profileFixture(), baseInput());

      expect(createAccount).toHaveBeenCalledWith(userId, {
        name: 'Efectivo',
        type: 'cash',
        currency: 'COP',
      });
      expect(writtenInput()?.accountId).toBe(ACCOUNT_ID);
    });

    it('prefers the cash account over one that sorts ahead of it by name', async () => {
      // listAccounts orders by name, so "Bancolombia *1111" comes first. A
      // spend typed in Telegram must not land on a card it never touched.
      vi.mocked(listAccounts).mockResolvedValue([
        { id: OTHER_ACCOUNT_ID, type: 'savings', currency: 'COP' } as never,
        { id: ACCOUNT_ID, type: 'cash', currency: 'COP' } as never,
      ]);

      await recordTransaction(userId, profileFixture(), baseInput());

      expect(writtenInput()?.accountId).toBe(ACCOUNT_ID);
    });

    it("routes a bank SMS to that card's own account", async () => {
      vi.mocked(findOrCreateBankAccount).mockResolvedValue({
        id: OTHER_ACCOUNT_ID,
        currency: 'COP',
      } as never);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        bankAccount: { bank: 'bancolombia', mask: '1111', label: 'Bancolombia', type: 'savings' },
      });

      expect(findOrCreateBankAccount).toHaveBeenCalledWith(userId, {
        bank: 'bancolombia',
        mask: '1111',
        name: 'Bancolombia *1111',
        type: 'savings',
        currency: 'COP',
      });
      expect(listAccounts).not.toHaveBeenCalled();
      expect(writtenInput()?.accountId).toBe(OTHER_ACCOUNT_ID);
    });

    it('keeps one account per bank when the message names no digits', async () => {
      vi.mocked(findOrCreateBankAccount).mockResolvedValue({
        id: OTHER_ACCOUNT_ID,
        currency: 'COP',
      } as never);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        bankAccount: { bank: 'banco_bogota', mask: null, label: 'Banco de Bogotá', type: 'savings' },
      });

      // '' and not NULL: a NULL mask would never collide in the UNIQUE, and
      // every digitless message would open a new account.
      expect(vi.mocked(findOrCreateBankAccount).mock.calls[0]?.[1]).toMatchObject({
        mask: '',
        name: 'Banco de Bogotá',
      });
    });

    it('answers a malformed account id instead of throwing', async () => {
      // toAccountId throws a TypeError on anything that is not a uuid. A
      // boundary has to answer; an unhandled throw here is a 500 in a route
      // handler that never asked to crash.
      const result = await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        accountId: 'not-a-uuid',
      });

      expect(result).toEqual({ ok: false, reason: 'unknown_account' });
      expect(getAccount).not.toHaveBeenCalled();
      expect(createTransaction).not.toHaveBeenCalled();
    });

    it('refuses an account id that is not this user, and writes nothing', async () => {
      // The isolation boundary: getAccount filters by userId, so someone
      // else's account comes back null rather than as a row we could write to.
      vi.mocked(getAccount).mockResolvedValue(null);

      const result = await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        accountId: OTHER_ACCOUNT_ID,
      });

      expect(result).toEqual({ ok: false, reason: 'unknown_account' });
      expect(createTransaction).not.toHaveBeenCalled();
    });
  });

  describe('currency', () => {
    it('lets the caller override the account currency, for a bank SMS', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        currency: 'USD',
        source: 'sms_shortcut',
      });

      // The message said dollars. Relabelling it to the account's pesos would
      // change what the number means.
      expect(writtenInput()?.currency).toBe('USD');
    });
  });

  describe('category', () => {
    it('answers a malformed category id instead of throwing', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);

      const result = await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        categoryId: 'not-a-uuid',
      });

      expect(result).toEqual({ ok: false, reason: 'unknown_category' });
      expect(getCategory).not.toHaveBeenCalled();
      expect(createTransaction).not.toHaveBeenCalled();
    });

    it('refuses a category id that is not this user, and writes nothing', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
      vi.mocked(getCategory).mockResolvedValue(null);

      const result = await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        categoryId: CATEGORY_ID,
      });

      expect(result).toEqual({ ok: false, reason: 'unknown_category' });
      expect(createTransaction).not.toHaveBeenCalled();
    });

    it("marks a caller-chosen category as 'manual' unless told otherwise", async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        categoryId: CATEGORY_ID,
      });

      expect(writtenInput()?.categorizedBy).toBe('manual');
    });

    it('records who categorised it when the caller says so', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        categoryId: CATEGORY_ID,
        categorizedBy: 'telegram',
      });

      expect(writtenInput()?.categorizedBy).toBe('telegram');
    });

    it('leaves categorizedBy null when there is no category', async () => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);

      await recordTransaction(userId, profileFixture(), baseInput());

      expect(writtenInput()?.categoryId).toBeNull();
      expect(writtenInput()?.categorizedBy).toBeNull();
    });
  });

  describe('the location gate', () => {
    const coords = { latitude: 4.65, longitude: -74.05 };

    beforeEach(() => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
    });

    it('stores nothing while the profile has location off', async () => {
      await recordTransaction(userId, profileFixture({ locationEnabled: false }), {
        ...baseInput(),
        location: coords,
      });

      expect(writtenInput()?.location).toBeNull();
    });

    it('stores the reading, tagged with the surface that sent it', async () => {
      await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
        ...baseInput(),
        location: { ...coords, accuracyM: 30 },
        locationSource: 'shortcut',
      });

      expect(writtenInput()?.location).toEqual({
        latitude: 4.65,
        longitude: -74.05,
        accuracyM: 30,
        source: 'shortcut',
      });
    });

    it('drops a reading coarser than the usable radius', async () => {
      // 900 m is a cell tower, not a street. Better no pin than a wrong one.
      await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
        ...baseInput(),
        location: { ...coords, accuracyM: 900 },
      });

      expect(writtenInput()?.location).toBeNull();
    });

    it('keeps a reading whose accuracy the device never reported', async () => {
      await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
        ...baseInput(),
        location: coords,
      });

      expect(writtenInput()?.location).toMatchObject({ accuracyM: null });
    });

    it('drops half a coordinate rather than writing a point in the Gulf of Guinea', async () => {
      await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
        ...baseInput(),
        location: { latitude: 4.65, longitude: null },
      });

      expect(writtenInput()?.location).toBeNull();
    });

    it('drops a coordinate outside the world rather than letting the CHECK reject it', async () => {
      // A caller that validates its own way - or forgets to - must not be able
      // to turn a spend into a driver error nobody can act on.
      await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
        ...baseInput(),
        location: { latitude: 91, longitude: -74.05 },
      });

      expect(writtenInput()?.location).toBeNull();
    });

    it('drops NaN and Infinity, which every null check would have let through', async () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
        vi.clearAllMocks();
        vi.mocked(listAccounts).mockResolvedValue([
          { id: ACCOUNT_ID, currency: 'COP' } as never,
        ]);
        vi.mocked(createTransaction).mockResolvedValue({
          transaction: { id: 'tx-1' } as never,
          isDuplicate: false,
        });

        await recordTransaction(userId, profileFixture({ locationEnabled: true }), {
          ...baseInput(),
          location: { latitude: bad, longitude: -74.05 },
        });

        expect(writtenInput()?.location).toBeNull();
      }
    });
  });

  describe('the sentence itself', () => {
    beforeEach(() => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
    });

    it('trims the merchant and turns a blank note into nothing', async () => {
      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        merchant: '  Juan Valdez  ',
        note: '   ',
      });

      expect(writtenInput()?.merchant).toBe('Juan Valdez');
      expect(writtenInput()?.note).toBeNull();
    });

    it('passes the idempotency key straight through, and reports a duplicate', async () => {
      vi.mocked(createTransaction).mockResolvedValue({
        transaction: { id: 'tx-1' } as never,
        isDuplicate: true,
      });

      const result = await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      });

      expect(writtenInput()?.idempotencyKey).toBe('55555555-5555-4555-8555-555555555555');
      expect(result).toMatchObject({ ok: true, isDuplicate: true });
    });
  });

  describe('the rule engine', () => {
    const suggestion = {
      ruleId: 'rule-1',
      categoryId: CATEGORY_ID as never,
      categoryName: 'Restaurantes',
      categoryIcon: 'Utensils',
    };

    beforeEach(() => {
      vi.mocked(listAccounts).mockResolvedValue([
        { id: ACCOUNT_ID, currency: 'COP' } as never,
      ]);
    });

    it('files the spend on its own when a rule knows the merchant', async () => {
      // Level 1: zero gestures. This is the destination, not the scaffolding.
      vi.mocked(suggestCategory).mockResolvedValue(suggestion);

      const result = await recordTransaction(userId, profileFixture(), baseInput());

      expect(writtenInput()?.categoryId).toBe(CATEGORY_ID);
      expect(writtenInput()?.categorizedBy).toBe('rule_engine');
      expect(result).toMatchObject({ ok: true, autoCategorized: true });
      expect(confirmSuggestionUsed).toHaveBeenCalledWith(userId, suggestion);
    });

    it('does not ask the engine when the caller already named a category', async () => {
      // An explicit choice is a statement of fact. The engine does not get a
      // vote on it, and must not quietly replace it.
      vi.mocked(getCategory).mockResolvedValue({ id: CATEGORY_ID } as never);

      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        categoryId: CATEGORY_ID,
      });

      expect(suggestCategory).not.toHaveBeenCalled();
      expect(writtenInput()?.categorizedBy).toBe('manual');
    });

    it('can be told to stay out of it', async () => {
      await recordTransaction(userId, profileFixture(), {
        ...baseInput(),
        skipRuleEngine: true,
      });

      expect(suggestCategory).not.toHaveBeenCalled();
      expect(writtenInput()?.categoryId).toBeNull();
    });

    it('does not count a firing on a duplicate it never decided', async () => {
      // hit_count is how METRICS.md reports whether level 1 is learning. A
      // retry of a message already stored decided nothing.
      vi.mocked(suggestCategory).mockResolvedValue(suggestion);
      vi.mocked(createTransaction).mockResolvedValue({
        transaction: { id: 'tx-1' } as never,
        isDuplicate: true,
      });

      await recordTransaction(userId, profileFixture(), baseInput());

      expect(confirmSuggestionUsed).not.toHaveBeenCalled();
    });

    it('leaves the transaction uncategorised when no rule matches', async () => {
      const result = await recordTransaction(userId, profileFixture(), baseInput());

      expect(writtenInput()?.categoryId).toBeNull();
      expect(writtenInput()?.categorizedBy).toBeNull();
      expect(result).toMatchObject({ autoCategorized: false });
    });
  });
});
