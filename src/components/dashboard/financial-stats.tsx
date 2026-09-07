import React from 'react';

import { Money } from '@/components/ui/money';
import { t } from '@/lib/i18n';

interface FinancialStatsProps {
  readonly totalExpenseMinor: bigint;
  readonly totalIncomeMinor: bigint;
  readonly transactionCount: number;
  readonly currency: string;
}

/**
 * Three boxless floating financial metrics directly over the luxury dark background.
 *
 * Provides genuine financial utility:
 * - Gastos (Monthly Outflow)
 * - Ingresos (Monthly Inflow)
 * - Movimientos (Transaction Count)
 */
export function FinancialStats({
  totalExpenseMinor,
  totalIncomeMinor,
  transactionCount,
  currency,
}: FinancialStatsProps): React.ReactElement {
  return (
    <div className="fin-stats-row">
      {/* 1. Gastos */}
      <div className="fin-stat-item">
        <span className="fin-stat-label">{t('stat_expenses')}</span>
        <div className="fin-stat-value fin-stat-value--expense">
          <Money amountMinor={totalExpenseMinor} currency={currency} />
        </div>
      </div>

      <div className="fin-stat-divider" aria-hidden="true" />

      {/* 2. Ingresos */}
      <div className="fin-stat-item">
        <span className="fin-stat-label">{t('stat_income')}</span>
        <div className="fin-stat-value fin-stat-value--income">
          <Money amountMinor={totalIncomeMinor} currency={currency} />
        </div>
      </div>

      <div className="fin-stat-divider" aria-hidden="true" />

      {/* 3. Movimientos */}
      <div className="fin-stat-item">
        <span className="fin-stat-label">{t('stat_movements')}</span>
        <div className="fin-stat-value">
          <span>
            {transactionCount} {t('stat_records_short')}
          </span>
        </div>
      </div>
    </div>
  );
}
