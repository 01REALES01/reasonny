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
  title: 'Dashboard — RealMoney',
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
        route: '/',
      });
    } catch (error) {
      console.error('[telemetry] failed to record dashboard latency:', error);
    }
  });

  return (
    <div
      className="desktop-dashboard-container animate-entrance-fade"
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: 'var(--space-4) var(--space-4) calc(var(--space-12) + 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        minHeight: '100vh',
      }}
    >
      {/* Top Navigation Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--brand-500) 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px var(--brand-tint)',
            }}
          >
            ◈
          </div>
          <div>
            <h1
              style={{
                fontSize: 'var(--text-title)',
                fontWeight: 600,
                color: 'var(--ink-primary)',
                lineHeight: 1.2,
              }}
            >
              RealMoney
            </h1>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>
              {session.email}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {data.uncategorizedCount > 0 && (
            <span
              style={{
                backgroundColor: 'rgba(224, 163, 46, 0.14)',
                color: 'var(--warning)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-caption)',
                fontWeight: 600,
              }}
            >
              {data.uncategorizedCount} {t('dashboard_pending_review')}
            </span>
          )}

          <a
            href="/api/v1/export"
            download
            title={t('dashboard_export_csv_title')}
            style={{
              backgroundColor: 'var(--surface-overlay)',
              color: 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ↓ {t('dashboard_export_csv')}
          </a>

          <Link
            href="/nuevo"
            style={{
              backgroundColor: 'var(--brand-500)',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px var(--brand-tint)',
            }}
          >
            + {t('dashboard_add')}
          </Link>
        </div>
      </header>

      {/* Main Responsive Grid (1 Column on Mobile, 2 Columns on Desktop) */}
      <div
        className="desktop-dashboard-grid"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Left Column (Overview & Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
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
        <section
          style={{
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            border: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            height: 'fit-content',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--text-heading)',
                fontWeight: 600,
                color: 'var(--ink-primary)',
              }}
            >
              {t('dashboard_recent_title')}
            </h3>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>
              {/* transactionCount, no recentTransactions.length: la lista
                  viene limitada a 20 por getRecentEnrichedTransactions, así que
                  a partir de la transacción 21 el rótulo se congelaba en "20"
                  para siempre. En una app de dinero un número que miente es
                  peor que no mostrarlo. */}
              {data.monthlyTotals.transactionCount} {t('monthly_records')}
            </span>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-10) 0',
                color: 'var(--ink-muted)',
                fontSize: 'var(--text-body)',
              }}
            >
              <p>{t('dashboard_empty')}</p>
              <Link
                href="/nuevo"
                style={{
                  color: 'var(--brand-400)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'inline-block',
                  marginTop: 'var(--space-2)',
                }}
              >
                {t('dashboard_empty_cta')} →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {data.recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Fixed Bottom Navigation for Mobile Only */}
      <nav
        className="desktop-hide-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(20, 20, 23, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: 'var(--space-3) 0 max(var(--space-3), env(safe-area-inset-bottom))',
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: 'var(--brand-400)',
            textDecoration: 'none',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
          }}
        >
          <span>◈</span>
          <span>{t('nav_home')}</span>
        </Link>
        <Link
          href="/nuevo"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: 'var(--ink-secondary)',
            textDecoration: 'none',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
          }}
        >
          <span>+</span>
          <span>{t('nav_new')}</span>
        </Link>
      </nav>
    </div>
  );
}
