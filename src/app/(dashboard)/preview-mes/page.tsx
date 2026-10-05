import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react';

import { CategoryBreakdownPanel } from '@/components/dashboard/category-breakdown-panel';
import { PhoneLedger } from '@/components/dashboard/phone-ledger';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
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

  const days: DayGroup[] = [
    {
      day: '2026-09-23',
      relative: 'today',
      totalExpenseMinor: 10480000n,
      transactions: [
        {
          id: 'tx-1',
          amountMinor: 1850000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          source: 'sms_shortcut',
          merchant: 'Starbucks Reserva · Chicó',
          note: null,
          transactionDate: new Date(),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-coffee',
            name: 'Café y Ocio',
            icon: 'Coffee',
            color: 'var(--brand-400)',
          },
          account: {
            id: 'acc-1',
            name: 'Bancolombia Débito',
            currency: 'COP',
          },
          location: null,
        },
      ],
    },
  ];

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
          <span className="month-switch-label">Septiembre 2026</span>
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

        <CategoryBreakdownPanel
          breakdown={breakdown}
          totalExpenseMinor={totalExpenseMinor}
          currency="COP"
        />

        <PhoneLedger days={days} currency="COP" />
      </div>
    </main>
  );
}
