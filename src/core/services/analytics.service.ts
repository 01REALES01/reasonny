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
  countUncategorizedTransactions,
  getCategorySpendingBreakdown,
  getMonthlyTotals,
  getRecentEnrichedTransactions,
  type CategorySpendingBreakdown,
  type EnrichedTransactionRow,
  type MonthlyTotals,
} from '@/core/repositories/transaction.repository';
import { toAccountId, type UserId } from '@/core/types';

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
 *
 * The year and month come from Intl because the calendar day depends on the
 * user's timezone (CLAUDE.md rule 4), but the December-to-January rollover is
 * left to Date.UTC, which already normalises an out-of-range month into the
 * next year. The hand-written `if (nextMonth > 12)` it replaces was correct;
 * it was just a reimplementation of something with no edge cases left in it.
 *
 * 'en-CA' gives an ISO-ordered YYYY-MM-DD, so the date part needs no padding
 * or reassembly by hand.
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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);

  // No `?? '2026'` defaults here any more. Those branches were unreachable -
  // formatToParts always emits the parts it was asked for - and had they ever
  // fired, they would have silently reported a hardcoded month's totals as if
  // they were this one's.
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);

  const isoDay = (y: number, monthIndex: number): string =>
    `${new Date(Date.UTC(y, monthIndex, 1)).toISOString().slice(0, 10)} 00:00:00`;

  return {
    startOfMonthIso: isoDay(year, month - 1),
    // month, not month + 1: the index is already zero-based, so passing the
    // one-based number lands on the following month, and December rolls into
    // January of year + 1 on its own.
    startOfNextMonthIso: isoDay(year, month),
    monthName: new Intl.DateTimeFormat('es-CO', {
      timeZone: timezone,
      month: 'long',
    }).format(date),
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
    uncategorizedCount,
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
    countUncategorizedTransactions(userId),
  ]);

  // toAccountId, not `as any`. The cast defeated the branded type at exactly
  // the boundary it exists to guard: `as any` would have let a userId, a
  // categoryId or a malformed string through to a balance query without a
  // word from the compiler. The constructor validates the uuid instead.
  const balances = await Promise.all(
    accounts.map((acc) => getAccountBalance(userId, toAccountId(acc.id))),
  );
  const totalBalanceMinor = balances.reduce(
    (total, balance) => total + (balance?.balanceMinor ?? 0n),
    0n,
  );

  const capitalizedMonth =
    bounds.monthName.charAt(0).toUpperCase() + bounds.monthName.slice(1);

  return {
    baseCurrency,
    timezone,
    totalBalanceMinor,
    monthlyTotals,
    categoryBreakdown,
    recentTransactions,
    uncategorizedCount,
    currentMonthLabel: `${capitalizedMonth} ${bounds.year}`,
  };
}
