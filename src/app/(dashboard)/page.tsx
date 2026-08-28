import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { HeroCard } from '@/components/dashboard/hero-card';
import { MonthlyCard } from '@/components/dashboard/monthly-card';
import { TransactionItem } from '@/components/dashboard/transaction-item';
import { getDashboardData } from '@/core/services/analytics.service';
import { toUserId } from '@/core/types';
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
  const data = await getDashboardData(userId);

  return (
    <div
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: 'var(--space-4) var(--space-4) calc(var(--space-12) + 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        minHeight: '100vh',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 'var(--space-2)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-title)',
              fontWeight: 600,
              color: 'var(--ink-primary)',
            }}
          >
            RealMoney
          </h1>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>
            {session.email}
          </span>
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
              {data.uncategorizedCount} por revisar
            </span>
          )}

          <a
            href="/api/v1/export"
            download
            title="Exportar todas las transacciones a CSV"
            style={{
              backgroundColor: 'var(--surface-overlay)',
              color: 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ↓ CSV
          </a>
        </div>
      </header>

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

      {/* 4. Recent Transactions List (DESIGN_SYSTEM.md 6.3) */}
      <section
        style={{
          backgroundColor: 'var(--surface-raised)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
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
            Últimos Movimientos
          </h3>
          <Link
            href="/nuevo"
            style={{
              color: 'var(--brand-400)',
              fontSize: 'var(--text-label)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            + Añadir
          </Link>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-8) 0',
              color: 'var(--ink-muted)',
              fontSize: 'var(--text-body)',
            }}
          >
            <p>Aún no hay transacciones registradas este mes.</p>
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
              Registrar primer gasto →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.recentTransactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </section>

      {/* Fixed Bottom Navigation (DESIGN_SYSTEM.md 6.8) */}
      <nav
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
          <span>Inicio</span>
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
          <span>Nuevo</span>
        </Link>
      </nav>
    </div>
  );
}
