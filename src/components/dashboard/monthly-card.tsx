import React from 'react';

import { t } from '@/lib/i18n';
import { Money } from '@/components/ui/money';
import type { MonthlyTotals } from '@/core/repositories/transaction.repository';

interface MonthlyCardProps {
  readonly monthlyTotals: MonthlyTotals;
  readonly monthLabel: string;
  readonly currency: string;
}

/**
 * Monthly Summary Card with mixed-weight heading (DESIGN_SYSTEM.md 3.4 & 6.2).
 */
export function MonthlyCard({
  monthlyTotals,
  monthLabel,
  currency,
}: MonthlyCardProps): React.ReactElement {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-heading)', fontWeight: 400, color: 'var(--ink-secondary)' }}>
          {t('monthly_spend_in')} <strong>{monthLabel}</strong>
        </h2>
        <span
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--ink-muted)',
            backgroundColor: 'var(--surface-overlay)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {monthlyTotals.transactionCount} {t('monthly_records')}
        </span>
      </div>

      <div style={{ fontSize: 'var(--text-display)', fontWeight: 600 }}>
        <Money amountMinor={monthlyTotals.totalExpenseMinor} currency={currency} />
      </div>

      {monthlyTotals.totalIncomeMinor > 0n && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-caption)',
            color: 'var(--positive)',
          }}
        >
          <span>↑ {t('monthly_income')}:</span>
          <Money
            amountMinor={monthlyTotals.totalIncomeMinor}
            currency={currency}
            showFractionDeEmphasis={false}
          />
        </div>
      )}
    </div>
  );
}
