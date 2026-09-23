import { formatMoney, money } from '@/core/money';
import type { CategorySpendingBreakdown } from '@/core/repositories/transaction.repository';
import type { DashboardData, MonthViewData } from '@/core/services/analytics.service';
import { intlTag, t, type Locale } from '@/lib/i18n';

import { categoryLabel } from './category-emoji';

/**
 * The dashboard, said out loud.
 *
 * WHY THIS IS PURE, AND WHY THAT MATTERS MORE THAN IT LOOKS
 * ---------------------------------------------------------
 * Every figure here comes from analytics.service.ts, which already groups by
 * `AT TIME ZONE` (rule 4) and already keeps money in minor units (rule 3).
 * This file adds no arithmetic on money beyond a percentage, so there is no
 * second place where "the total for September" could be computed differently
 * from what the dashboard shows. A bot that disagrees with the app about a
 * number is worse than a bot with no numbers at all.
 *
 * It is also the shape the language model will narrate in the next phase: the
 * model picks a tool, the tool returns these same structures, and the model
 * describes them. It never adds anything up itself - so a wrong figure would
 * have to come from a tested service rather than from a guess.
 */

/** The app's own rule: no amount is rendered by hand. */
function amount(minor: bigint, currency: string, locale: Locale): string {
  return formatMoney(money(minor, currency), intlTag(locale));
}

/**
 * Aligns the label column so the numbers line up in Telegram's proportional
 * font. Not perfect - only a monospace block would be - but padding the label
 * costs nothing and a ragged column of money is genuinely hard to read.
 */
function row(label: string, value: string): string {
  return `${label}  ${value}`;
}

function movements(count: number, locale: Locale): string {
  return `${count} ${t(count === 1 ? 'bot_movements_one' : 'bot_movements_many', locale)}`;
}

export function balanceReport(data: DashboardData, locale: Locale): string {
  const { baseCurrency: c } = data;

  return [
    `${t('bot_balance_title', locale)}`,
    `${amount(data.totalBalanceMinor, c, locale)}`,
    '',
    data.currentMonthLabel,
    row(t('bot_month_expenses', locale), amount(data.monthlyTotals.totalExpenseMinor, c, locale)),
    row(t('bot_month_income', locale), amount(data.monthlyTotals.totalIncomeMinor, c, locale)),
  ].join('\n');
}

export function todayReport(data: DashboardData, locale: Locale): string {
  const { baseCurrency: c } = data;
  // `relative` is computed in the service against the user's timezone. Reading
  // it rather than comparing dates here keeps the one definition of "today".
  const today = data.recentDays.find((day) => day.relative === 'today');
  const count = today?.transactions.length ?? 0;

  const lines = [
    t('bot_today_title', locale),
    `${amount(data.week.todayExpenseMinor, c, locale)}  ·  ${movements(count, locale)}`,
    '',
    t('bot_week_label', locale),
    amount(data.week.weekExpenseMinor, c, locale),
  ];

  return lines.join('\n');
}

/**
 * Five, then everything else as one line.
 *
 * A month with fifteen categories is a wall of text on a phone, and the tail
 * of it is where the amounts stop mattering. Collapsing the rest into a total
 * keeps the message honest - the percentages still add up - without asking
 * anyone to read fifteen rows.
 */
const TOP_CATEGORIES = 5;

function share(totalMinor: bigint, ofMinor: bigint): string {
  if (ofMinor <= 0n) {
    return '';
  }
  // Integer maths on minor units. Converting to float first would be the one
  // place in the app where money touches a double, for a number that is only
  // ever displayed rounded anyway.
  return `  ${Number((totalMinor * 100n) / ofMinor)}%`;
}

function categoryLine(
  entry: CategorySpendingBreakdown,
  totalExpenseMinor: bigint,
  currency: string,
  locale: Locale,
): string {
  const label = entry.categoryName
    ? categoryLabel(entry.categoryName, entry.categoryIcon)
    : `• ${t('bot_month_uncategorized', locale)}`;

  return `${label}  ${amount(entry.totalMinor, currency, locale)}${share(entry.totalMinor, totalExpenseMinor)}`;
}

export function monthReport(data: MonthViewData, locale: Locale): string {
  const { baseCurrency: c, monthlyTotals: totals } = data;

  if (totals.transactionCount === 0) {
    return `📊 ${data.monthLabel}\n\n${t('bot_no_movements', locale)}`;
  }

  const balanceMinor = totals.totalIncomeMinor - totals.totalExpenseMinor;
  // The sign is the point of this line, and Intl drops a leading '+'.
  const balanceText =
    (balanceMinor > 0n ? '+' : '') + amount(balanceMinor, c, locale);

  const lines = [
    `📊 ${data.monthLabel}`,
    '',
    row(t('bot_month_expenses', locale), amount(totals.totalExpenseMinor, c, locale)),
    row(t('bot_month_income', locale), amount(totals.totalIncomeMinor, c, locale)),
    row(t('bot_month_balance', locale), balanceText),
  ];

  const ranked = [...data.categoryBreakdown].sort((a, b) =>
    a.totalMinor === b.totalMinor ? 0 : a.totalMinor > b.totalMinor ? -1 : 1,
  );
  const top = ranked.slice(0, TOP_CATEGORIES);
  const rest = ranked.slice(TOP_CATEGORIES);

  if (top.length > 0) {
    lines.push('');
    for (const entry of top) {
      lines.push(categoryLine(entry, totals.totalExpenseMinor, c, locale));
    }
  }

  if (rest.length > 0) {
    const restMinor = rest.reduce((sum, entry) => sum + entry.totalMinor, 0n);
    lines.push(
      `${t('bot_month_other_categories', locale)} (${rest.length})  ` +
        `${amount(restMinor, c, locale)}${share(restMinor, totals.totalExpenseMinor)}`,
    );
  }

  return lines.join('\n');
}
