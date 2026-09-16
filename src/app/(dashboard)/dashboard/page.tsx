import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { BalanceHero } from '@/components/dashboard/balance-hero';
import { CaptureCallout } from '@/components/dashboard/capture-callout';
import { FinancialActions } from '@/components/dashboard/financial-actions';
import { PhoneLedger } from '@/components/dashboard/phone-ledger';
import { WeekSpendingCard } from '@/components/dashboard/week-spending';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getAutomaticCaptureStatus } from '@/core/repositories/transaction.repository';
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
  // In parallel: the callout below is decided by the second, and making it wait
  // for the first would add a Neon round trip to the screen with the tightest
  // LCP budget in the app.
  const [data, capture] = await Promise.all([
    getDashboardData(userId),
    getAutomaticCaptureStatus(userId),
  ]);
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

      {/* 2. This week's spending, day by day, with today and the month */}
      <WeekSpendingCard
        week={data.week}
        monthExpenseMinor={data.monthlyTotals.totalExpenseMinor}
        currency={data.baseCurrency}
      />

      {/* 3. Purposeful Financial Actions (+ Registrar gasto, + Ingreso) */}
      <FinancialActions />

      {/* Only until the pipe has actually delivered something. See the note in
          the component for why it leaves rather than turning into a tick. */}
      {capture.count === 0 && <CaptureCallout />}

      {/* 4. Recent transactions, one header per day */}
      <PhoneLedger days={data.recentDays} currency={data.baseCurrency} />
    </div>
  );
}



