/**
 * Analytics Domain Service (Principle P9).
 *
 * All financial aggregation and analytical logic lives here. Neither the PWA,
 * nor Telegram, nor future native clients compute summaries on their own.
 */

import {
  getAccountBalance,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getProfile } from '@/core/repositories/profile.repository';
import {
  getCategorySpendingBreakdown,
  getMonthlyTotals,
  getRecentEnrichedTransactions,
  getUncategorizedTransactions,
  type CategorySpendingBreakdown,
  type EnrichedTransactionRow,
  type MonthlyTotals,
} from '@/core/repositories/transaction.repository';
import type { UserId } from '@/core/types';

export interface DashboardData {
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly totalBalanceMinor: bigint;
  readonly monthlyTotals: MonthlyTotals;
  readonly categoryBreakdown: CategorySpendingBreakdown[];
  readonly recentTransactions: EnrichedTransactionRow[];
  readonly uncategorizedCount: number;
  readonly currentMonthLabel: string;
}

/**
 * Computes the ISO local date bounds 'YYYY-MM-01 00:00:00' for a given month and timezone.
 */
export function getMonthDateBounds(
  date: Date,
  timezone: string,
): {
  startOfMonthIso: string;
  startOfNextMonthIso: string;
  monthName: string;
  year: number;
} {
  // Format current date in target timezone to extract local year and month
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const yearStr = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const monthStr = parts.find((p) => p.type === 'month')?.value ?? '8';

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const startMonthPadded = month.toString().padStart(2, '0');
  const startOfMonthIso = `${year}-${startMonthPadded}-01 00:00:00`;

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthPadded = nextMonth.toString().padStart(2, '0');
  const startOfNextMonthIso = `${nextYear}-${nextMonthPadded}-01 00:00:00`;

  const monthNameFormatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    month: 'long',
  });
  const monthName = monthNameFormatter.format(date);

  return {
    startOfMonthIso,
    startOfNextMonthIso,
    monthName,
    year,
  };
}

/**
 * Loads all analytical metrics required to render the primary dashboard.
 */
export async function getDashboardData(
  userId: UserId,
  referenceDate: Date = new Date(),
): Promise<DashboardData> {
  const profile = await getProfile(userId);
  const timezone = profile?.timezone ?? 'America/Bogota';
  const baseCurrency = profile?.baseCurrency ?? 'COP';

  const bounds = getMonthDateBounds(referenceDate, timezone);

  const [
    accounts,
    monthlyTotals,
    categoryBreakdown,
    recentTransactions,
    uncategorized,
  ] = await Promise.all([
    listAccounts(userId),
    getMonthlyTotals(
      userId,
      timezone,
      bounds.startOfMonthIso,
      bounds.startOfNextMonthIso,
    ),
    getCategorySpendingBreakdown(
      userId,
      timezone,
      bounds.startOfMonthIso,
      bounds.startOfNextMonthIso,
    ),
    getRecentEnrichedTransactions(userId, 20),
    getUncategorizedTransactions(userId, 100),
  ]);

  // Compute total balance across all accounts
  let totalBalanceMinor = 0n;
  const balancePromises = accounts.map((acc) =>
    getAccountBalance(userId, acc.id as any),
  );
  const balances = await Promise.all(balancePromises);

  for (const b of balances) {
    if (b) {
      totalBalanceMinor += b.balanceMinor;
    }
  }

  const capitalizedMonth =
    bounds.monthName.charAt(0).toUpperCase() + bounds.monthName.slice(1);

  return {
    baseCurrency,
    timezone,
    totalBalanceMinor,
    monthlyTotals,
    categoryBreakdown,
    recentTransactions,
    uncategorizedCount: uncategorized.length,
    currentMonthLabel: `${capitalizedMonth} ${bounds.year}`,
  };
}
