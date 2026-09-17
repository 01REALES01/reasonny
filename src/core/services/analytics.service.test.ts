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
  getDailyExpenseTotals: vi.fn(),
  getAutomaticCaptureStatus: vi.fn(),
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
  getDailyExpenseTotals,
  getAutomaticCaptureStatus,
  type EnrichedTransactionRow,
} from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';

import {
  getDashboardData,
  getMonthDateBounds,
  getMonthViewData,
  getWeekDayKeys,
  groupByDay,
} from './analytics.service';

function row(id: string, isoDate: string): EnrichedTransactionRow {
  return {
    id,
    amountMinor: 4500000n,
    currency: 'COP',
    type: 'expense',
    status: 'confirmed',
    source: 'sms_shortcut',
    merchant: 'Éxito',
    note: null,
    transactionDate: new Date(isoDate),
    categorizedBy: null,
    category: null,
    account: null,
    location: null,
  };
}

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
      (getDailyExpenseTotals as any).mockResolvedValue([]);
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
          source: 'sms_shortcut',
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

      (getAutomaticCaptureStatus as any).mockResolvedValue({
        count: 5,
        lastAt: new Date('2026-08-27T11:00:00Z'),
      });

      (countUncategorizedTransactions as any).mockResolvedValue(0);

      (getDailyExpenseTotals as any).mockResolvedValue([
        { day: '2026-08-20', totalExpenseMinor: 9000000n },
        { day: '2026-08-25', totalExpenseMinor: 2000000n },
        { day: '2026-08-27', totalExpenseMinor: 1000000n },
      ]);

      // Thursday 27 August in Bogotá: the week runs Monday 24 to Sunday 30.
      const data = await getDashboardData(userId, new Date('2026-08-27T12:00:00Z'));

      expect(data.baseCurrency).toBe('COP');
      expect(data.timezone).toBe('America/Bogota');
      expect(data.totalBalanceMinor).toBe(200000000n);
      expect(data.monthlyTotals.totalExpenseMinor).toBe(45000000n);
      expect(data.autoCaptureCount).toBe(5);
      expect(data.lastCaptureAt).toBe('2026-08-27T11:00:00.000Z');
      expect(data.categoryBreakdown).toHaveLength(1);
      expect(data.uncategorizedCount).toBe(0);

      // The oldest listed row is older than the week, so the totals reach it.
      expect(getDailyExpenseTotals).toHaveBeenCalledWith(
        userId,
        'America/Bogota',
        '2026-08-20 00:00:00',
      );
      expect(data.recentDays).toHaveLength(1);
      // The day's SQL total, not the one row the list happened to fetch.
      expect(data.recentDays[0]?.totalExpenseMinor).toBe(9000000n);

      expect(data.week.today).toBe('2026-08-27');
      expect(data.week.days.map((d) => d.day)).toEqual([
        '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
        '2026-08-28', '2026-08-29', '2026-08-30',
      ]);
      expect(data.week.todayExpenseMinor).toBe(1000000n);
      expect(data.week.weekExpenseMinor).toBe(3000000n);
    });
  });

  describe('Days and weeks', () => {
    it('starts the week on Monday, including from a Sunday', () => {
      expect(getWeekDayKeys('2026-08-30')[0]).toBe('2026-08-24');
      expect(getWeekDayKeys('2026-08-24')[0]).toBe('2026-08-24');
    });

    it('crosses a month boundary', () => {
      expect(getWeekDayKeys('2026-09-01')).toEqual([
        '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
        '2026-09-04', '2026-09-05', '2026-09-06',
      ]);
    });

    /** 02:00 UTC on 1 September is 21:00 on 31 August in Bogotá. */
    it('groups by the local day and labels today and yesterday', () => {
      const groups = groupByDay(
        [
          row('a', '2026-09-01T15:00:00Z'),
          row('b', '2026-09-01T02:00:00Z'),
          row('c', '2026-08-29T15:00:00Z'),
        ],
        'America/Bogota',
        '2026-09-01',
        [{ day: '2026-08-31', totalExpenseMinor: 4500000n }],
      );

      expect(groups.map((g) => [g.day, g.relative, g.transactions.length])).toEqual([
        ['2026-09-01', 'today', 1],
        ['2026-08-31', 'yesterday', 1],
        ['2026-08-29', null, 1],
      ]);
      expect(groups[1]?.totalExpenseMinor).toBe(4500000n);
      expect(groups[0]?.totalExpenseMinor).toBe(0n);
    });
  });
});
