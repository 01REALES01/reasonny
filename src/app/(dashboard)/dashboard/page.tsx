import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { BalanceHero } from '@/components/dashboard/balance-hero';
import { FinancialActions } from '@/components/dashboard/financial-actions';
import { FinancialStats } from '@/components/dashboard/financial-stats';
import { PhoneLedger } from '@/components/dashboard/phone-ledger';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getDashboardData } from '@/core/services/analytics.service';
import { recordMetric } from '@/core/services/telemetry.service';
import { toUserId } from '@/core/types';
import { shouldShowOnboarding } from '@/lib/onboarding';
import { getCurrentUser } from '@/lib/session';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Dashboard — Reasonny',
  robots: { index: false, follow: false },
};

export default async function DashboardPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);

  // The gate lives here rather than in the sign-in form so it also catches the
  // PWA launching straight to /dashboard and a bookmark opened weeks later -
  // every way in, not just the one that goes through the OTP screen.
  if (await shouldShowOnboarding(userId, profile)) {
    redirect('/bienvenida');
  }

  const queryStartedAt = performance.now();
  const data = await getDashboardData(userId);
  const queryDurationMs = performance.now() - queryStartedAt;

  after(async () => {
    try {
      await recordMetric(userId, {
        metric: 'dashboard_query_duration',
        value: queryDurationMs,
        route: '/dashboard',
      });
    } catch (error) {
      console.error('[telemetry] failed to record dashboard latency:', error);
    }
  });

  return (
    <div className="phone-screen-container animate-entrance-1">
      {/* 1. Authentic Luxury Velvet Balance Hero */}
      <BalanceHero
        totalBalanceMinor={data.totalBalanceMinor}
        currency={data.baseCurrency}
        userEmail={session.email}
        displayName={profile.fullName}
        monthLabel={data.currentMonthLabel}
        uncategorizedCount={data.uncategorizedCount}
      />

      {/* 2. Three Boxless Floating Financial Metrics (Gastos, Ingresos, Movimientos) */}
      <FinancialStats
        totalExpenseMinor={data.monthlyTotals.totalExpenseMinor}
        totalIncomeMinor={data.monthlyTotals.totalIncomeMinor}
        transactionCount={data.monthlyTotals.transactionCount}
        currency={data.baseCurrency}
      />

      {/* 3. Purposeful Financial Actions (+ Registrar gasto, + Ingreso) */}
      <FinancialActions />

      {/* 4. Stream of Recent Transactions */}
      <PhoneLedger transactions={data.recentTransactions} timeZone={profile.timezone} />
    </div>
  );
}



