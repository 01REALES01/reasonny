import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  requireCurrentUser: vi.fn(),
}));

vi.mock('@/core/repositories/profile.repository', () => ({
  getProfile: vi.fn(),
  ensureProfile: vi.fn(),
}));

vi.mock('@/core/repositories/account.repository', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  getAccount: vi.fn(),
}));

vi.mock('@/core/repositories/category.repository', () => ({
  getCategory: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  createTransaction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  createAccount,
  getAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getCategory } from '@/core/repositories/category.repository';
import { ensureProfile, getProfile } from '@/core/repositories/profile.repository';
import { createTransaction } from '@/core/repositories/transaction.repository';
import { requireCurrentUser } from '@/lib/session';

import { createQuickTransactionAction } from './transactions';

describe('createQuickTransactionAction Server Action', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const accountId = '22222222-2222-4222-8222-222222222222';
  const categoryId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    (requireCurrentUser as any).mockResolvedValue({
      id: userId,
      email: 'jean@example.com',
    });
    (getProfile as any).mockResolvedValue({
      id: userId,
      baseCurrency: 'COP',
    });
    (ensureProfile as any).mockResolvedValue({
      id: userId,
      baseCurrency: 'COP',
    });
    (listAccounts as any).mockResolvedValue([
      { id: accountId, name: 'Principal', currency: 'COP' },
    ]);
    // The ownership lookups resolve by default. The tests that matter override
    // them to null, which is what a repository returns for a row belonging to
    // someone else - the id is valid, it just is not yours.
    (getAccount as any).mockResolvedValue({
      id: accountId,
      name: 'Principal',
      currency: 'COP',
    });
    (getCategory as any).mockResolvedValue({ id: categoryId, name: 'Café' });
    (createTransaction as any).mockResolvedValue({
      transaction: { id: '44444444-4444-4444-4444-444444444444' },
      isDuplicate: false,
    });
  });

  it('records transaction successfully with valid inputs', async () => {
    const result = await createQuickTransactionAction({
      amount: '45.000',
      merchant: 'Juan Valdez',
      type: 'expense',
      categoryId,
      accountId,
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('44444444-4444-4444-4444-444444444444');
    expect(createTransaction).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        amountMinor: 4500000n,
        merchant: 'Juan Valdez',
        type: 'expense',
      }),
    );
  });

  it('rejects missing or empty merchant', async () => {
    const result = await createQuickTransactionAction({
      amount: '45.000',
      merchant: '',
      type: 'expense',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Merchant is required/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('rejects invalid or zero amount', async () => {
    const result = await createQuickTransactionAction({
      amount: '0',
      merchant: 'Taxi',
      type: 'expense',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/greater than 0/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  /**
   * The two checks that stop one tenant writing against another's rows.
   *
   * Both ids reach this action from a <select> in the browser. A branded type
   * proves the string is a well-formed uuid and nothing more, and neither
   * foreign key carries the owner: transactions.account_id references
   * accounts.id alone, not (user_id, id). Without these lookups the database
   * accepts the row, and getAccountBalance used to sum it into the other
   * user's balance.
   */
  it('refuses an accountId that belongs to somebody else', async () => {
    (getAccount as any).mockResolvedValue(null);

    const result = await createQuickTransactionAction({
      amount: '45.000',
      merchant: 'Juan Valdez',
      type: 'expense',
      accountId: '99999999-9999-4999-8999-999999999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown account/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('refuses a categoryId that belongs to somebody else', async () => {
    (getCategory as any).mockResolvedValue(null);

    const result = await createQuickTransactionAction({
      amount: '45.000',
      merchant: 'Juan Valdez',
      type: 'expense',
      accountId,
      categoryId: '99999999-9999-4999-8999-999999999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown category/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('takes the currency from the verified account, not the request', async () => {
    // The account row is the authority on its own currency. Reading it from
    // anywhere else is how a USD account ends up holding a COP amount.
    (getAccount as any).mockResolvedValue({
      id: accountId,
      name: 'Ahorros USD',
      currency: 'USD',
    });

    await createQuickTransactionAction({
      amount: '45.00',
      merchant: 'Juan Valdez',
      type: 'expense',
      accountId,
    });

    expect(createTransaction).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ currency: 'USD' }),
    );
  });

  it('creates a default account if user has none configured', async () => {
    (listAccounts as any).mockResolvedValue([]);
    (createAccount as any).mockResolvedValue({
      id: accountId,
      name: 'Efectivo',
      currency: 'COP',
    });

    const result = await createQuickTransactionAction({
      amount: '12000',
      merchant: 'Panadería',
      type: 'expense',
    });

    expect(result.success).toBe(true);
    expect(createAccount).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        name: 'Efectivo',
        type: 'cash',
      }),
    );
  });
});
