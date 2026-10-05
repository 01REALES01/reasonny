import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';

import { DashboardExperience } from '@/components/dashboard/dashboard-experience';
import { getWeekDayKeys, type DashboardData, type DayGroup, type WeekSpending } from '@/core/services/analytics.service';
import { OnboardingFlow } from '../bienvenida/onboarding-flow';

export const metadata: Metadata = {
  title: 'Preview App — Reasonny',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Development-only screenshots of the dashboard and onboarding with made-up
 * data. Outside `next dev` it does not exist: the route has no session check
 * because it touches no database, so a 404 is the only thing keeping a
 * stranger from loading it in production.
 */
export default async function PreviewPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  if (process.env.NODE_ENV === 'production') notFound();

  const params = await searchParams;
  const view = params?.view;

  if (view === 'bienvenida') {
    return (
      <main className="entry-page entry-page--bienvenida">
        <OnboardingFlow initialName="Carlos" baseCurrency="COP" />
      </main>
    );
  }
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const prevDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const prevStr = prevDate.toISOString().slice(0, 10);

  const weekDays = getWeekDayKeys(todayStr);

  const week: WeekSpending = {
    today: todayStr,
    todayExpenseMinor: 10480000n, // $104.800
    weekExpenseMinor: 89400000n, // $894.000
    prevWeekSameDaysExpenseMinor: 78000000n, // $780.000
    prevWeekTotalExpenseMinor: 105000000n,
    weekOverWeekDeltaPct: 15, // +15% vs sem. anterior
    days: [
      { day: weekDays[0]!, totalExpenseMinor: 15400000n }, // Lunes: $154.000
      { day: weekDays[1]!, totalExpenseMinor: 19000000n }, // Martes: $190.000
      { day: weekDays[2]!, totalExpenseMinor: 28000000n }, // Miércoles: $280.000
      { day: weekDays[3]!, totalExpenseMinor: 16520000n }, // Jueves: $165.200
      { day: weekDays[4]!, totalExpenseMinor: 10480000n }, // Viernes (Hoy): $104.800
      { day: weekDays[5]!, totalExpenseMinor: 0n },        // Sábado (Día por delante)
      { day: weekDays[6]!, totalExpenseMinor: 0n },        // Domingo (Día por delante)
    ],
  };

  const recentDays: DayGroup[] = [
    {
      day: todayStr,
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
          transactionDate: new Date(now.getTime() - 15 * 60 * 1000),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-coffee',
            name: 'Cafetería',
            icon: 'Coffee',
            color: 'var(--brand-400)',
          },
          account: {
            id: 'acc-bancolombia',
            name: 'Bancolombia Ahorros · *1111',
            currency: 'COP',
          },
          location: null,
        },
        {
          id: 'tx-2',
          amountMinor: 8630000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          source: 'sms_shortcut',
          merchant: 'Éxito Express · Cra 11',
          note: null,
          transactionDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-market',
            name: 'Supermercado',
            icon: 'ShoppingCart',
            color: 'var(--cat-5)',
          },
          account: {
            id: 'acc-bancolombia',
            name: 'Bancolombia Ahorros · *1111',
            currency: 'COP',
          },
          location: null,
        },
      ],
    },
    {
      day: yesterdayStr,
      relative: 'yesterday',
      totalExpenseMinor: 5930000n,
      transactions: [
        {
          id: 'tx-3',
          amountMinor: 2480000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          source: 'sms_shortcut',
          merchant: 'Uber Trip · Carrera 7',
          note: null,
          transactionDate: new Date(yesterdayDate.getTime() + 19 * 3600 * 1000),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-transport',
            name: 'Transporte',
            icon: 'Car',
            color: 'var(--positive)',
          },
          account: {
            id: 'acc-nu',
            name: 'Nu Colombia · *3333',
            currency: 'COP',
          },
          location: null,
        },
        {
          id: 'tx-4',
          amountMinor: 3450000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          source: 'sms_shortcut',
          merchant: 'Rappi · Farmacia',
          note: null,
          transactionDate: new Date(yesterdayDate.getTime() + 14 * 3600 * 1000),
          categorizedBy: 'rule_engine',
          category: {
            id: 'cat-health',
            name: 'Salud',
            icon: 'HeartPulse',
            color: 'var(--brand-500)',
          },
          account: {
            id: 'acc-nu',
            name: 'Nu Colombia · *3333',
            currency: 'COP',
          },
          location: null,
        },
      ],
    },
    {
      day: prevStr,
      relative: null,
      totalExpenseMinor: 1420000n,
      transactions: [
        {
          id: 'tx-5',
          amountMinor: 1420000n,
          currency: 'COP',
          type: 'expense',
          status: 'confirmed',
          source: 'telegram_text',
          merchant: 'Café Juan Valdez',
          note: null,
          transactionDate: new Date(prevDate.getTime() + 11 * 3600 * 1000),
          categorizedBy: 'telegram',
          category: {
            id: 'cat-coffee',
            name: 'Cafetería',
            icon: 'Coffee',
            color: 'var(--brand-400)',
          },
          account: {
            id: 'acc-cash',
            name: 'Efectivo',
            currency: 'COP',
          },
          location: null,
        },
      ],
    },
  ];

  const previewAccounts = [
    {
      id: 'acc-davivienda',
      name: 'Davivienda Nómina · *2222',
      type: 'savings',
      currency: 'COP',
    },
    {
      id: 'acc-bancolombia',
      name: 'Bancolombia Ahorros · *1111',
      type: 'savings',
      currency: 'COP',
    },
    {
      id: 'acc-nu',
      name: 'Nu Colombia · *3333',
      type: 'credit_card',
      currency: 'COP',
    },
  ];

  const isNewUser = view === 'new-user';

  const previewData: DashboardData = {
    baseCurrency: 'COP',
    timezone: 'America/Bogota',
    totalBalanceMinor: isNewUser ? 0n : 1425000000n, // $14.250.000 COP
    monthlyTotals: {
      totalExpenseMinor: isNewUser ? 0n : 382000000n, // $3.820.000 COP
      totalIncomeMinor: isNewUser ? 0n : 950000000n,
      transactionCount: isNewUser ? 0 : 24,
    },
    categoryBreakdown: [],
    recentDays: isNewUser ? [] : recentDays,
    week: isNewUser
      ? {
          today: todayStr,
          todayExpenseMinor: 0n,
          weekExpenseMinor: 0n,
          prevWeekSameDaysExpenseMinor: 0n,
          prevWeekTotalExpenseMinor: 0n,
          weekOverWeekDeltaPct: 0,
          days: weekDays.map((d) => ({ day: d, totalExpenseMinor: 0n })),
        }
      : week,
    uncategorizedCount: 0,
    currentMonthLabel: 'Septiembre 2026',
    lastCaptureAt: isNewUser ? null : new Date(now.getTime() - 42 * 1000).toISOString(),
    autoCaptureCount: isNewUser ? 0 : 48,
    accounts: isNewUser ? [] : previewAccounts.map((a) => ({ ...a, color: 'var(--brand-500)' })),
  };

  return (
    <div
      className="phone-screen-container animate-entrance-1"
      style={{
        minHeight: '100vh',
        paddingTop: '68px',
        paddingBottom: '90px',
      }}
    >
      <DashboardExperience
        data={previewData}
        userEmail="demo@example.com"
        displayName="Carlos"
      />

      {view === 'ledger' && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.scrollTo(0, document.body.scrollHeight);`,
          }}
        />
      )}
    </div>
  );
}
