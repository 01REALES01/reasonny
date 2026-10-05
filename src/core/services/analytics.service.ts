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
  getAutomaticCaptureStatus,
  getCategorySpendingBreakdown,
  getDailyExpenseTotals,
  getEnrichedTransactionsInMonth,
  getMonthlyTotals,
  getRecentEnrichedTransactions,
  type CategorySpendingBreakdown,
  type DailyExpenseTotal,
  type EnrichedTransactionRow,
  type MonthlyTotals,
} from '@/core/repositories/transaction.repository';
import { toAccountId, type UserId } from '@/core/types';

/** Transactions of one local calendar day, newest first, under its header. */
export interface DayGroup {
  /** 'YYYY-MM-DD' in the profile's zone. */
  readonly day: string;
  readonly relative: 'today' | 'yesterday' | null;
  /** The whole day's confirmed spending, from SQL - not just the rows listed. */
  readonly totalExpenseMinor: bigint;
  readonly transactions: EnrichedTransactionRow[];
}

export interface WeekSpending {
  /** 'YYYY-MM-DD' in the profile's zone. */
  readonly today: string;
  /** Monday to Sunday of the current local week, always seven entries. */
  readonly days: DailyExpenseTotal[];
  readonly todayExpenseMinor: bigint;
  readonly weekExpenseMinor: bigint;
  /** Expense in the previous week across the same days (Monday to today). Null if no baseline. */
  readonly prevWeekSameDaysExpenseMinor?: bigint | null;
  /** Full previous week total expense (Monday to Sunday). Null if no data. */
  readonly prevWeekTotalExpenseMinor?: bigint | null;
  /** Percentage change vs same period last week (+X or -X). Null if no baseline. */
  readonly weekOverWeekDeltaPct?: number | null;
}

export interface DashboardAccount {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly currency: string;
  readonly color: string;
}

export interface DashboardData {
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly totalBalanceMinor: bigint;
  readonly monthlyTotals: MonthlyTotals;
  readonly categoryBreakdown: CategorySpendingBreakdown[];
  readonly recentDays: DayGroup[];
  readonly week: WeekSpending;
  readonly uncategorizedCount: number;
  readonly currentMonthLabel: string;
  readonly lastCaptureAt: string | null;
  readonly autoCaptureCount: number;
  readonly accounts?: readonly DashboardAccount[];
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
 * The zero-padding comes from toISOString(), not from a locale: the date is
 * rebuilt with Date.UTC and sliced, so no part of the string is assembled by
 * hand. The two Intl formatters here are only for reading the local year and
 * month ('en-US') and for the display name of the month ('es-CO').
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

const isoDate = (year: number, monthIndex: number, day: number): string =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

/**
 * Returns a reader for the local 'YYYY-MM-DD' a Date falls on.
 *
 * A reader rather than a plain function so a list of 200 rows builds one
 * Intl.DateTimeFormat, not 200.
 */
export function dayKeyReader(timezone: string): (date: Date) => string {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  return (date) => {
    const parts = format.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((p) => p.type === type)!.value);
    return isoDate(get('year'), get('month') - 1, get('day'));
  };
}

/**
 * Moves a day key by whole days. The key is already local, so this is plain
 * calendar arithmetic in UTC: no zone or DST change can shift it.
 */
function shiftDayKey(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return isoDate(year!, month! - 1, date! + days);
}

/** Monday to Sunday of the week containing `today` - Monday, as the Colombian calendar has it. */
export function getWeekDayKeys(today: string): string[] {
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(today, i - mondayOffset));
}

/**
 * Splits rows ordered newest first into one group per local day.
 *
 * The day comes from the profile's zone, like the totals beside it: grouped in
 * UTC, a 21:00 spend in Bogotá would sit under tomorrow's header.
 */
export function groupByDay(
  rows: readonly EnrichedTransactionRow[],
  timezone: string,
  today: string,
  dailyTotals: readonly DailyExpenseTotal[],
): DayGroup[] {
  const readDay = dayKeyReader(timezone);
  const yesterday = shiftDayKey(today, -1);
  const totals = new Map(dailyTotals.map((d) => [d.day, d.totalExpenseMinor]));
  const groups: DayGroup[] = [];

  for (const tx of rows) {
    const day = readDay(tx.transactionDate);
    const current = groups.at(-1);
    if (current?.day === day) {
      current.transactions.push(tx);
      continue;
    }
    groups.push({
      day,
      relative: day === today ? 'today' : day === yesterday ? 'yesterday' : null,
      totalExpenseMinor: totals.get(day) ?? 0n,
      transactions: [tx],
    });
  }

  return groups;
}

export interface MonthViewData {
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly monthlyTotals: MonthlyTotals;
  readonly categoryBreakdown: CategorySpendingBreakdown[];
  readonly days: DayGroup[];
  readonly monthLabel: string;
  /** 0 is the current month, -1 the previous one. Never positive. */
  readonly offset: number;
  readonly isCurrentMonth: boolean;
}

/**
 * Shifts a date by whole months, in the user's timezone.
 *
 * Day 1 is used deliberately rather than the current day of the month: stepping
 * back one month from 31 March lands on 31 February, which Date normalises to
 * 2 or 3 March, so the user would ask for February and be shown March.
 */
function shiftMonths(date: Date, timezone: string, offset: number): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);

  // Midday, not midnight: a UTC midnight is the previous calendar day in every
  // timezone west of Greenwich, so getMonthDateBounds would read the wrong
  // month back out for a Bogotá user.
  return new Date(Date.UTC(year, month - 1 + offset, 1, 12));
}

/**
 * One month of history: totals, breakdown and the transactions inside it.
 *
 * The dashboard only ever knew about the current month, so there was nothing to
 * compare against and no way to look at what was already closed.
 */
export async function getMonthViewData(
  userId: UserId,
  offset: number,
  referenceDate: Date = new Date(),
): Promise<MonthViewData> {
  const profile = await getProfile(userId);
  const timezone = profile?.timezone ?? 'America/Bogota';
  const baseCurrency = profile?.baseCurrency ?? 'COP';

  // Clamped at 0: there is no data in the future, and a positive offset would
  // render an empty month that looks like a bug.
  const safeOffset = Math.min(0, Math.trunc(offset));
  const target = shiftMonths(referenceDate, timezone, safeOffset);
  const bounds = getMonthDateBounds(target, timezone);

  const [monthlyTotals, categoryBreakdown, transactions, dailyTotals] = await Promise.all([
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
    getEnrichedTransactionsInMonth(
      userId,
      timezone,
      bounds.startOfMonthIso,
      bounds.startOfNextMonthIso,
    ),
    getDailyExpenseTotals(
      userId,
      timezone,
      bounds.startOfMonthIso,
      bounds.startOfNextMonthIso,
    ),
  ]);

  const capitalizedMonth =
    bounds.monthName.charAt(0).toUpperCase() + bounds.monthName.slice(1);

  return {
    baseCurrency,
    timezone,
    monthlyTotals,
    categoryBreakdown,
    days: groupByDay(transactions, timezone, dayKeyReader(timezone)(referenceDate), dailyTotals),
    monthLabel: `${capitalizedMonth} ${bounds.year}`,
    offset: safeOffset,
    isCurrentMonth: safeOffset === 0,
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
  const readDay = dayKeyReader(timezone);
  const today = readDay(referenceDate);
  const weekDays = getWeekDayKeys(today);

  const [
    accounts,
    monthlyTotals,
    categoryBreakdown,
    recentTransactions,
    uncategorizedCount,
    captureStatus,
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
    getAutomaticCaptureStatus(userId),
  ]);

  // The daily totals ride in the second round trip the balances already need,
  // so they cost no extra latency. They wait for the list because the range
  // has to reach its oldest day: summing only the 20 rows fetched would print
  // a wrong total under the last header whenever that day had more.
  const oldestListed = recentTransactions.at(-1);
  const oldestDay = oldestListed ? readDay(oldestListed.transactionDate) : today;
  const prevWeekMonday = shiftDayKey(weekDays[0]!, -7);
  const prevWeekDays = Array.from({ length: 7 }, (_, i) => shiftDayKey(prevWeekMonday, i));
  const since = oldestDay < prevWeekMonday ? oldestDay : prevWeekMonday;

  // toAccountId, not `as any`. The cast defeated the branded type at exactly
  // the boundary it exists to guard: `as any` would have let a userId, a
  // categoryId or a malformed string through to a balance query without a
  // word from the compiler. The constructor validates the uuid instead.
  const [balances, dailyTotals] = await Promise.all([
    Promise.all(accounts.map((acc) => getAccountBalance(userId, toAccountId(acc.id)))),
    getDailyExpenseTotals(userId, timezone, `${since} 00:00:00`),
  ]);
  const totalBalanceMinor = balances.reduce(
    (total, balance) => total + (balance?.balanceMinor ?? 0n),
    0n,
  );

  const totalFor = (day: string): bigint =>
    dailyTotals.find((d) => d.day === day)?.totalExpenseMinor ?? 0n;
  const weekTotals = weekDays.map((day) => ({ day, totalExpenseMinor: totalFor(day) }));

  // Index of today in the week (0 = Monday, ..., 6 = Sunday)
  const todayIndex = weekDays.indexOf(today);
  const activeDaysCount = todayIndex >= 0 ? todayIndex + 1 : 7;
  const sameDaysLastWeek = prevWeekDays.slice(0, activeDaysCount);

  const prevWeekSameDaysExpenseMinor = sameDaysLastWeek.reduce(
    (total, day) => total + totalFor(day),
    0n,
  );
  const prevWeekTotalExpenseMinor = prevWeekDays.reduce(
    (total, day) => total + totalFor(day),
    0n,
  );

  const thisWeekSoFarMinor = weekTotals
    .slice(0, activeDaysCount)
    .reduce((total, d) => total + d.totalExpenseMinor, 0n);

  let weekOverWeekDeltaPct: number | null = null;
  if (prevWeekSameDaysExpenseMinor > 0n) {
    const deltaMinor = thisWeekSoFarMinor - prevWeekSameDaysExpenseMinor;
    weekOverWeekDeltaPct = Math.round(
      Number((deltaMinor * 1000n) / prevWeekSameDaysExpenseMinor) / 10,
    );
  }

  const dashboardAccounts: DashboardAccount[] = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    currency: acc.currency,
    color: acc.color,
  }));

  const capitalizedMonth =
    bounds.monthName.charAt(0).toUpperCase() + bounds.monthName.slice(1);

  return {
    baseCurrency,
    timezone,
    totalBalanceMinor,
    monthlyTotals,
    categoryBreakdown,
    recentDays: groupByDay(recentTransactions, timezone, today, dailyTotals),
    week: {
      today,
      days: weekTotals,
      todayExpenseMinor: totalFor(today),
      weekExpenseMinor: weekTotals.reduce((total, d) => total + d.totalExpenseMinor, 0n),
      prevWeekSameDaysExpenseMinor,
      prevWeekTotalExpenseMinor,
      weekOverWeekDeltaPct,
    },
    uncategorizedCount,
    currentMonthLabel: `${capitalizedMonth} ${bounds.year}`,
    lastCaptureAt: captureStatus.lastAt ? captureStatus.lastAt.toISOString() : null,
    autoCaptureCount: captureStatus.count,
    accounts: dashboardAccounts,
  };
}
