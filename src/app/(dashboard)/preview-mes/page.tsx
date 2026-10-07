import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react';

import { CategoryBreakdownPanel } from '@/components/dashboard/category-breakdown-panel';
import { MonthCalendar } from '@/components/dashboard/month-calendar';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { formatDate } from '@/lib/i18n';
import type { DayGroup } from '@/core/services/analytics.service';
import type { CategorySpendingBreakdown } from '@/core/repositories/transaction.repository';

export const metadata: Metadata = {
  title: 'Preview Mes — Reasonny',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Development-only, like /preview: see the note there. */
export default function PreviewMesPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();

  const breakdown: CategorySpendingBreakdown[] = [
    {
      categoryId: 'cat-housing',
      categoryName: 'Vivienda',
      categoryIcon: 'Home',
      categoryColor: 'var(--brand-500)',
      totalMinor: 160000000n, // $1.600.000
      transactionCount: 2,
    },
    {
      categoryId: 'cat-food',
      categoryName: 'Alimentación',
      categoryIcon: 'ShoppingCart',
      categoryColor: 'var(--cat-5)',
      totalMinor: 106960000n, // $1.069.600
      transactionCount: 18,
    },
    {
      categoryId: 'cat-transport',
      categoryName: 'Transporte',
      categoryIcon: 'Car',
      categoryColor: 'var(--positive)',
      totalMinor: 68760000n, // $687.600
      transactionCount: 14,
    },
    {
      categoryId: 'cat-leisure',
      categoryName: 'Café y Ocio',
      categoryIcon: 'Coffee',
      categoryColor: 'var(--brand-400)',
      totalMinor: 45840000n, // $458.400
      transactionCount: 12,
    },
  ];

  const totalExpenseMinor = 381560000n; // $3.815.600
  const totalIncomeMinor = 650000000n; // $6.500.000

  // A made-up month up to today: a few spends on most days, nothing on some,
  // so the calendar shows icons, totals and empty days together.
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const monthKey = todayKey.slice(0, 7);
  const monthName = formatDate(`${monthKey}-15T12:00:00Z`, 'UTC', undefined, { month: 'long' });
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthKey.slice(0, 4)}`;
  const kinds = [
    { id: 'cat-coffee', name: 'Cafetería', icon: 'Coffee', color: 'var(--brand-400)', merchant: 'Café Juan Valdez', amount: 1_420_000n },
    { id: 'cat-market', name: 'Supermercado', icon: 'ShoppingCart', color: 'var(--cat-5)', merchant: 'Éxito Express', amount: 8_630_000n },
    { id: 'cat-transport', name: 'Transporte', icon: 'Car', color: 'var(--positive)', merchant: 'Uber', amount: 2_480_000n },
    { id: 'cat-health', name: 'Salud', icon: 'HeartPulse', color: 'var(--brand-500)', merchant: 'Farmacia', amount: 3_450_000n },
  ];
  const days: DayGroup[] = [];
  for (let d = Number(todayKey.slice(8)); d >= 1; d--) {
    if (d % 4 === 3) continue;
    const day = `${monthKey}-${String(d).padStart(2, '0')}`;
    const picks = [kinds[d % 4]!, ...(d % 2 === 0 ? [kinds[(d + 1) % 4]!] : [])];
    const transactions = picks.map((k, i) => ({
      id: `tx-${day}-${i}`,
      amountMinor: k.amount + BigInt(d) * 10_000n,
      currency: 'COP',
      type: 'expense' as const,
      status: 'confirmed' as const,
      source: 'sms_shortcut' as const,
      merchant: k.merchant,
      note: null,
      transactionDate: new Date(`${day}T${String(9 + i * 5).padStart(2, '0')}:30:00-05:00`),
      categorizedBy: 'rule_engine' as const,
      category: { id: k.id, name: k.name, icon: k.icon, color: k.color },
      account: { id: 'acc-bancolombia', name: 'Bancolombia', currency: 'COP' },
      location: null,
    }));
    days.push({
      day,
      relative: day === todayKey ? 'today' : null,
      totalExpenseMinor: transactions.reduce((sum, tx) => sum + tx.amountMinor, 0n),
      transactions,
    });
  }

  return (
    <main
      className="entry-page entry-page--mes"
      style={{
        minHeight: '100vh',
        paddingTop: '68px',
        paddingBottom: '90px',
      }}
    >
      <div className="entry animate-entrance-1">
        <div className="entry-bar">
          <Link href="/preview" className="entry-back">
            <CategoryIcon name="ArrowLeft" size={15} />
            <span>Volver al inicio</span>
          </Link>
        </div>

        <nav className="month-switch" aria-label="Navegación de mes">
          <span className="month-switch-btn" aria-hidden="true">
            <CategoryIcon name="ArrowLeft" size={16} />
          </span>
          <span className="month-switch-label">{monthLabel}</span>
          <span className="month-switch-btn month-switch-btn--disabled" aria-hidden="true">
            <CategoryIcon name="ArrowRight" size={16} />
          </span>
        </nav>

        <div className="month-totals">
          <div className="month-total">
            <span className="fin-stat-label">Gastos del mes</span>
            <span className="month-total-value">
              <Money amountMinor={totalExpenseMinor} currency="COP" />
            </span>
          </div>
          <div className="month-total">
            <span className="fin-stat-label">Ingresos</span>
            <span className="month-total-value month-total-value--income">
              <Money amountMinor={totalIncomeMinor} currency="COP" />
            </span>
          </div>
        </div>

        <MonthCalendar
          days={days}
          monthKey={monthKey}
          todayKey={todayKey}
          currency="COP"
          timeZone="America/Bogota"
        />

        <CategoryBreakdownPanel
          breakdown={breakdown}
          totalExpenseMinor={totalExpenseMinor}
          currency="COP"
        />


      </div>
    </main>
  );
}
