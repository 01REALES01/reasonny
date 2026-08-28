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
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  createTransaction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  createAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
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
