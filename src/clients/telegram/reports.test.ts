import { describe, expect, it } from 'vitest';

import type { DashboardData, MonthViewData } from '@/core/services/analytics.service';

import { balanceReport, monthReport, todayReport } from './reports';

/** $12.000 COP is 1_200_000 minor units. Scale 100, always (rule 3). */
const COP = (pesos: number): bigint => BigInt(pesos) * 100n;

function category(name: string | null, icon: string, pesos: number) {
  return {
    categoryId: name ? 'cat-1' : null,
    categoryName: name,
    categoryIcon: icon,
    categoryColor: '#F59E0B',
    totalMinor: COP(pesos),
    transactionCount: 3,
  };
}

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    baseCurrency: 'COP',
    timezone: 'America/Bogota',
    totalBalanceMinor: COP(1_234_500),
    monthlyTotals: {
      totalExpenseMinor: COP(847_300),
      totalIncomeMinor: COP(2_500_000),
      transactionCount: 12,
    },
    categoryBreakdown: [],
    recentDays: [
      {
        day: '2026-09-23',
        relative: 'today',
        totalExpenseMinor: COP(45_000),
        transactions: [{}, {}, {}],
      },
    ],
    week: {
      today: '2026-09-23',
      days: [],
      todayExpenseMinor: COP(45_000),
      weekExpenseMinor: COP(312_400),
    },
    uncategorizedCount: 28,
    currentMonthLabel: 'Septiembre 2026',
    lastCaptureAt: null,
    autoCaptureCount: 0,
    ...overrides,
  } as DashboardData;
}

function monthView(overrides: Partial<MonthViewData> = {}): MonthViewData {
  return {
    baseCurrency: 'COP',
    timezone: 'America/Bogota',
    monthlyTotals: {
      totalExpenseMinor: COP(1_000_000),
      totalIncomeMinor: COP(2_500_000),
      transactionCount: 20,
    },
    categoryBreakdown: [
      category('Restaurantes', 'Utensils', 400_000),
      category('Supermercado', 'ShoppingCart', 300_000),
    ],
    days: [],
    monthLabel: 'Septiembre 2026',
    offset: 0,
    isCurrentMonth: true,
    ...overrides,
  } as MonthViewData;
}

describe('what the bot says when asked', () => {
  describe('/saldo', () => {
    it('leads with the balance, then the month', () => {
      const text = balanceReport(dashboard(), 'es');

      expect(text).toContain('1.234.500');
      expect(text).toContain('Septiembre 2026');
      expect(text).toContain('847.300');
    });

    it('formats through Intl, never by hand', () => {
      // COP shows no decimals; a hand-rolled formatter would print ",00".
      expect(balanceReport(dashboard(), 'es')).not.toContain(',00');
    });
  });

  describe('/hoy', () => {
    it('reads "today" from the service, not from a date comparison here', () => {
      // `relative` is computed AT TIME ZONE upstream (rule 4). Recomputing it
      // in the client is how a spend at 20:00 in Bogota lands on tomorrow.
      const text = todayReport(dashboard(), 'es');

      expect(text).toContain('45.000');
      expect(text).toContain('3 movimientos');
      expect(text).toContain('312.400');
    });

    it('says "1 movimiento", not "1 movimientos"', () => {
      const data = dashboard({
        recentDays: [
          { day: '2026-09-23', relative: 'today', totalExpenseMinor: COP(9_000), transactions: [{}] },
        ],
      } as Partial<DashboardData>);

      expect(todayReport(data, 'es')).toContain('1 movimiento');
      expect(todayReport(data, 'es')).not.toContain('1 movimientos');
    });

    it('answers 0 movements on a day with nothing, instead of nothing at all', () => {
      const data = dashboard({ recentDays: [] } as Partial<DashboardData>);

      expect(todayReport(data, 'es')).toContain('0 movimientos');
    });
  });

  describe('/mes', () => {
    it('shows the balance with its sign, which Intl drops', () => {
      // "+$1.500.000" reads as a good month at a glance; "$1.500.000" does not.
      expect(monthReport(monthView(), 'es')).toContain('+');
    });

    it('marks a negative month without inventing a minus', () => {
      const data = monthView({
        monthlyTotals: {
          totalExpenseMinor: COP(3_000_000),
          totalIncomeMinor: COP(1_000_000),
          transactionCount: 20,
        },
      } as Partial<MonthViewData>);

      const text = monthReport(data, 'es');
      expect(text).toContain('-');
      expect(text).not.toContain('+-');
    });

    it('computes the share on integers, never through a float', () => {
      // 400.000 of 1.000.000 is 40%. The arithmetic stays in minor units.
      expect(monthReport(monthView(), 'es')).toContain('40%');
    });

    it('collapses everything past the top five into one line', () => {
      const data = monthView({
        categoryBreakdown: [
          category('Uno', 'Tag', 300_000),
          category('Dos', 'Tag', 200_000),
          category('Tres', 'Tag', 150_000),
          category('Cuatro', 'Tag', 100_000),
          category('Cinco', 'Tag', 90_000),
          category('Seis', 'Tag', 60_000),
          category('Siete', 'Tag', 40_000),
        ],
      } as Partial<MonthViewData>);

      const text = monthReport(data, 'es');
      expect(text).toContain('Cinco');
      expect(text).not.toContain('Siete');
      // The tail is still counted, so the percentages continue to add up.
      expect(text).toContain('Otras categorías (2)');
      expect(text).toContain('100.000');
    });

    it('names the uncategorised bucket through the catalog, not through SQL', () => {
      const data = monthView({
        categoryBreakdown: [category(null, 'Tag', 500_000)],
      } as Partial<MonthViewData>);

      expect(monthReport(data, 'es')).toContain('sin categoría');
      expect(monthReport(data, 'en')).toContain('uncategorized');
    });

    it('says a month is empty instead of printing a wall of zeros', () => {
      const data = monthView({
        monthlyTotals: { totalExpenseMinor: 0n, totalIncomeMinor: 0n, transactionCount: 0 },
        categoryBreakdown: [],
      } as Partial<MonthViewData>);

      const text = monthReport(data, 'es');
      expect(text).toContain('Todavía no hay movimientos');
      expect(text).not.toContain('Gastos');
    });

    it('does not divide by zero when a month has income but no spending', () => {
      const data = monthView({
        monthlyTotals: { totalExpenseMinor: 0n, totalIncomeMinor: COP(500_000), transactionCount: 1 },
        categoryBreakdown: [],
      } as Partial<MonthViewData>);

      expect(() => monthReport(data, 'es')).not.toThrow();
      expect(monthReport(data, 'es')).not.toContain('NaN');
    });
  });
});
