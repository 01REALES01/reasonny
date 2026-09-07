import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { HeroCard } from '@/components/dashboard/hero-card';
import { MonthlyCard } from '@/components/dashboard/monthly-card';
import { TransactionItem } from '@/components/dashboard/transaction-item';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getDashboardData } from '@/core/services/analytics.service';
import { recordMetric } from '@/core/services/telemetry.service';
import { toUserId } from '@/core/types';
import { t } from '@/lib/i18n';
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
  await ensureProfile(userId, session.email);

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
    <div className="dash desktop-dashboard-container">
      {/* Top Navigation Header.
          The entrance rides on the header and the grid, never on the container:
          that would make it the containing block for the fixed nav below, and
          it must not start transparent either. See globals.css. */}
      <header className="dash-header animate-entrance-1">
        <div className="dash-identity">
          <div className="dash-mark" aria-hidden="true">
            ◈
          </div>
          <div>
            <h1 className="dash-title">Reasonny</h1>
            <span className="dash-email">{session.email}</span>
          </div>
        </div>

        <div className="dash-actions">
          {data.uncategorizedCount > 0 && (
            <span className="dash-badge">
              {data.uncategorizedCount} {t('dashboard_pending_review')}
            </span>
          )}

          <a
            href="/api/v1/export"
            download
            title={t('dashboard_export_csv_title')}
            className="dash-action dash-action--secondary"
          >
            ↓ {t('dashboard_export_csv')}
          </a>

          <Link href="/nuevo" className="dash-action dash-action--primary">
            + {t('dashboard_add')}
          </Link>
        </div>
      </header>

      {/* Main Responsive Grid (1 Column on Mobile, 2 Columns on Desktop) */}
      <div className="dash-grid desktop-dashboard-grid animate-entrance-2">
        {/* Left Column (Overview & Cards) */}
        <div className="dash-column">
          {/* 1. Hero Balance Card (DESIGN_SYSTEM.md 6.1) */}
          <HeroCard
            totalBalanceMinor={data.totalBalanceMinor}
            currency={data.baseCurrency}
          />

          {/* 2. Monthly Spending Card (DESIGN_SYSTEM.md 6.2) */}
          <MonthlyCard
            monthlyTotals={data.monthlyTotals}
            monthLabel={data.currentMonthLabel}
            currency={data.baseCurrency}
          />

          {/* 3. Category Breakdown (DESIGN_SYSTEM.md 6.6) */}
          <CategoryBreakdown
            breakdown={data.categoryBreakdown}
            totalExpenseMinor={data.monthlyTotals.totalExpenseMinor}
            currency={data.baseCurrency}
          />
        </div>

        {/* Right Column (Transactions Ledger) */}
        <section className="dash-ledger">
          <div className="dash-ledger-header">
            <h3 className="dash-ledger-title">{t('dashboard_recent_title')}</h3>
            <span className="dash-ledger-count">
              {data.monthlyTotals.transactionCount} {t('monthly_records')}
            </span>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div className="dash-empty">
              <p>{t('dashboard_empty')}</p>
              <Link href="/nuevo">{t('dashboard_empty_cta')} →</Link>
            </div>
          ) : (
            <div className="dash-list">
              {data.recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Fixed Bottom Navigation for Mobile Only */}
      <nav className="dash-nav desktop-hide-bottom-nav">
        <Link href="/dashboard" aria-current="page">
          <span aria-hidden="true">◈</span>
          <span>{t('nav_home')}</span>
        </Link>
        <Link href="/nuevo">
          <span aria-hidden="true">+</span>
          <span>{t('nav_new')}</span>
        </Link>
      </nav>
    </div>
  );
}
