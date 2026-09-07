import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/profile.repository', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/core/repositories/account.repository', () => ({
  listAccounts: vi.fn(),
  getAccountBalance: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  getMonthlyTotals: vi.fn(),
  getCategorySpendingBreakdown: vi.fn(),
  getRecentEnrichedTransactions: vi.fn(),
  getEnrichedTransactionsInMonth: vi.fn(),
  countUncategorizedTransactions: vi.fn(),
}));

import {
  getAccountBalance,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getProfile } from '@/core/repositories/profile.repository';
import {
  getCategorySpendingBreakdown,
  getMonthlyTotals,
  getRecentEnrichedTransactions,
  getEnrichedTransactionsInMonth,
  countUncategorizedTransactions,
} from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';

import {
  getDashboardData,
  getMonthDateBounds,
  getMonthViewData,
} from './analytics.service';

describe('Analytics Service & Timezone Boundaries', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Timezone Month Boundaries (CLAUDE.md Rule 4)', () => {
    it('accurately resolves August for 31-Aug 20:00 Bogotá (which is 01-Sep 01:00 UTC)', () => {
      // 2026-09-01T01:00:00Z is 2026-08-31 20:00 in America/Bogota (UTC-5)
      const lateEveningUtcDate = new Date('2026-09-01T01:00:00Z');
      const bounds = getMonthDateBounds(lateEveningUtcDate, 'America/Bogota');

      expect(bounds.year).toBe(2026);
      expect(bounds.startOfMonthIso).toBe('2026-08-01 00:00:00');
      expect(bounds.startOfNextMonthIso).toBe('2026-09-01 00:00:00');
    });

    it('rolls over correctly on December to January boundary', () => {
      const decDate = new Date('2026-12-15T12:00:00Z');
      const bounds = getMonthDateBounds(decDate, 'America/Bogota');

      expect(bounds.year).toBe(2026);
      expect(bounds.startOfMonthIso).toBe('2026-12-01 00:00:00');
      expect(bounds.startOfNextMonthIso).toBe('2027-01-01 00:00:00');
    });
  });

  describe('Month navigation', () => {
    function mockMonthQueries(): void {
      (getProfile as any).mockResolvedValue({
        id: userId,
        timezone: 'America/Bogota',
        baseCurrency: 'COP',
      });
      (getMonthlyTotals as any).mockResolvedValue({
        totalExpenseMinor: 0n,
        totalIncomeMinor: 0n,
        transactionCount: 0,
      });
      (getCategorySpendingBreakdown as any).mockResolvedValue([]);
      (getEnrichedTransactionsInMonth as any).mockResolvedValue([]);
    }

    /**
     * The bug this guards: stepping back a month by subtracting 1 from the
     * month of a Date that still carries the current day. From 31 March that
     * builds 31 February, which Date normalises forward into March - so asking
     * for the previous month returns the one you are already looking at.
     */
    it('steps back to February from the 31st of March', async () => {
      mockMonthQueries();
      const march31 = new Date('2026-03-31T15:00:00Z');

      const data = await getMonthViewData(userId, -1, march31);

      expect(getMonthlyTotals).toHaveBeenCalledWith(
        userId,
        'America/Bogota',
        '2026-02-01 00:00:00',
        '2026-03-01 00:00:00',
      );
      expect(data.isCurrentMonth).toBe(false);
    });

    it('steps back across the January boundary into the previous year', async () => {
      mockMonthQueries();
      const jan15 = new Date('2026-01-15T12:00:00Z');

      await getMonthViewData(userId, -1, jan15);

      expect(getMonthlyTotals).toHaveBeenCalledWith(
        userId,
        'America/Bogota',
        '2025-12-01 00:00:00',
        '2026-01-01 00:00:00',
      );
    });

    it('clamps a future offset to the current month', async () => {
      mockMonthQueries();
      const june = new Date('2026-06-10T12:00:00Z');

      const data = await getMonthViewData(userId, 5, june);

      expect(data.offset).toBe(0);
      expect(data.isCurrentMonth).toBe(true);
      expect(getMonthlyTotals).toHaveBeenCalledWith(
        userId,
        'America/Bogota',
        '2026-06-01 00:00:00',
        '2026-07-01 00:00:00',
      );
    });

    /**
     * 1 June 02:00 UTC is still 31 May in Bogotá. The shifted date must be
     * built at midday, or it lands on the previous calendar day in every
     * timezone west of Greenwich and the view silently shows the wrong month.
     */
    it('resolves the month in the user timezone, not UTC', async () => {
      mockMonthQueries();
      const stillMayInBogota = new Date('2026-06-01T02:00:00Z');

      await getMonthViewData(userId, 0, stillMayInBogota);

      expect(getMonthlyTotals).toHaveBeenCalledWith(
        userId,
        'America/Bogota',
        '2026-05-01 00:00:00',
        '2026-06-01 00:00:00',
      );
    });
  });

  describe('Dashboard Data Aggregation', () => {
    it('aggregates total balances and monthly metrics', async () => {
      (getProfile as any).mockResolvedValue({
        id: userId,
        timezone: 'America/Bogota',
        baseCurrency: 'COP',
      });

      (listAccounts as any).mockResolvedValue([
        { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Checking', currency: 'COP' },
        { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', name: 'Savings', currency: 'COP' },
      ]);

      (getAccountBalance as any)
        .mockResolvedValueOnce({ balanceMinor: 150000000n, currency: 'COP' })
        .mockResolvedValueOnce({ balanceMinor: 50000000n, currency: 'COP' });

      (getMonthlyTotals as any).mockResolvedValue({
        totalExpenseMinor: 45000000n,
        totalIncomeMinor: 120000000n,
        transactionCount: 15,
      });

      (getCategorySpendingBreakdown as any).mockResolvedValue([
        {
          categoryId: 'cat-1',
          categoryName: 'Supermercado',
          categoryIcon: 'ShoppingCart',
          categoryColor: '#10B981',
          totalMinor: 25000000n,
          transactionCount: 4,
        },
      ]);

      (getRecentEnrichedTransactions as any).mockResolvedValue([
        {
          id: 'tx-1',
          amountMinor: 4500000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          merchant: 'Éxito',
          note: null,
          transactionDate: new Date('2026-08-20T10:00:00Z'),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-1',
            name: 'Supermercado',
            icon: 'ShoppingCart',
            color: '#10B981',
          },
          account: { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Checking', currency: 'COP' },
        },
      ]);

      (countUncategorizedTransactions as any).mockResolvedValue(0);

      const data = await getDashboardData(userId, new Date('2026-08-27T12:00:00Z'));

      expect(data.baseCurrency).toBe('COP');
      expect(data.timezone).toBe('America/Bogota');
      expect(data.totalBalanceMinor).toBe(200000000n);
      expect(data.monthlyTotals.totalExpenseMinor).toBe(45000000n);
      expect(data.categoryBreakdown).toHaveLength(1);
      expect(data.recentTransactions).toHaveLength(1);
      expect(data.uncategorizedCount).toBe(0);
    });
  });
});
