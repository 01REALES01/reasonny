import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { MonthlyTotals } from '@/core/repositories/transaction.repository';
import { t } from '@/lib/i18n';

interface MonthlyCardProps {
  readonly monthlyTotals: MonthlyTotals;
  readonly monthLabel: string;
  readonly currency: string;
}

/**
 * Monthly summary card with mixed-weight heading (DESIGN_SYSTEM.md 3.4 & 6.2).
 */
export function MonthlyCard({
  monthlyTotals,
  monthLabel,
  currency,
}: MonthlyCardProps): React.ReactElement {
  // Compute daily average for elapsed days in the current month
  const currentDay = Math.max(1, new Date().getDate());
  const dailyAverageMinor =
    monthlyTotals.totalExpenseMinor > 0n
      ? monthlyTotals.totalExpenseMinor / BigInt(currentDay)
      : 0n;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">
          {t('monthly_spend_in')} <strong>{monthLabel}</strong>
        </h2>
        <span className="panel-count">
          {monthlyTotals.transactionCount} {t('monthly_records')}
        </span>
      </div>

      <div className="panel-figure">
        <Money amountMinor={monthlyTotals.totalExpenseMinor} currency={currency} />
      </div>

      {monthlyTotals.totalIncomeMinor > 0n && (
        <div className="panel-income">
          <CategoryIcon name="TrendingUp" size={14} />
          <span>{t('monthly_income')}</span>
          <Money
            amountMinor={monthlyTotals.totalIncomeMinor}
            currency={currency}
            showFractionDeEmphasis={false}
          />
        </div>
      )}

      {dailyAverageMinor > 0n && (
        <div className="panel-velocity">
          <span>{t('daily_average')}</span>
          <strong>
            <Money
              amountMinor={dailyAverageMinor}
              currency={currency}
              showFractionDeEmphasis={false}
            />
          </strong>
        </div>
      )}
    </section>
  );
}
