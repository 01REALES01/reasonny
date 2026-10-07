/**
 * The month calendar on /mes - the parts that are arithmetic, kept pure so
 * they are tested without a browser or a database.
 *
 * Everything works on day KEYS ('YYYY-MM-DD'), which are already calendar
 * dates in the user's timezone: the grouping into days happened upstream, in
 * SQL with AT TIME ZONE (rule 4). Nothing here converts a timestamp, so
 * nothing here can move a spend across midnight.
 */
import { add, compare, money, type Money } from '@/core/money';

/**
 * The month as weeks of seven, Monday first, with null for the cells before
 * the 1st and after the last day. Colombia, like most of the world outside
 * the US, starts the week on Monday - and so does the week card on the home
 * screen, which the calendar has to agree with.
 */
export function buildMonthGrid(monthKey: string): (string | null)[][] {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay: Sunday 0 ... Saturday 6. Shifted so Monday is 0.
  const leadingBlanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${monthKey}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export interface CategorySpend {
  readonly icon: string;
  readonly color: string;
  readonly amount: Money;
}

interface SpendLike {
  readonly type: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly category: { readonly id: string; readonly icon: string; readonly color: string } | null;
}

/**
 * The categories a day's spending went to, largest first, at most `limit`.
 *
 * Expenses only - income is not where the money went. Uncategorised spends
 * are left out rather than drawn as a generic icon: the cell is there to say
 * "coffee and groceries", and "something" says nothing.
 */
export function topCategories(
  transactions: readonly SpendLike[],
  currency: string,
  limit: number,
): CategorySpend[] {
  const byCategory = new Map<string, CategorySpend>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.category || tx.currency !== currency) continue;
    const previous = byCategory.get(tx.category.id);
    const amount = money(tx.amountMinor, currency);
    byCategory.set(tx.category.id, {
      icon: tx.category.icon,
      color: tx.category.color,
      amount: previous ? add(previous.amount, amount) : amount,
    });
  }
  return [...byCategory.values()]
    .sort((a, b) => compare(b.amount, a.amount))
    .slice(0, limit);
}

/**
 * How many months back a day key is from today's, for the /mes?dia= link
 * from the week card. 0 for this month, -1 for the previous one; never
 * positive, matching the offset /mes accepts.
 */
export function monthOffsetForDay(dayKey: string, todayKey: string): number {
  const [y, m] = dayKey.split('-').map(Number) as [number, number];
  const [ty, tm] = todayKey.split('-').map(Number) as [number, number];
  return Math.min(0, y * 12 + m - (ty * 12 + tm));
}

/** A well-formed 'YYYY-MM-DD' that names a real date. */
export function isDayKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
