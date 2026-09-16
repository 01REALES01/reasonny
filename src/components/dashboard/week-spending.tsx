import React from 'react';

import { Money } from '@/components/ui/money';
import type { WeekSpending } from '@/core/services/analytics.service';
import { formatDate, t } from '@/lib/i18n';

interface WeekSpendingCardProps {
  readonly week: WeekSpending;
  readonly monthExpenseMinor: bigint;
  readonly currency: string;
}

// A day with a small spend still gets a visible bar: next to a big day it would
// otherwise round to nothing and read as "spent nothing", which is false.
const MIN_BAR_SHARE = 0.06;

/**
 * The week at a glance: its total, one bar per day and today against the month.
 *
 * Server-rendered and JS-free. The bars grow with transform only, so the
 * entrance costs the compositor and never the INP budget.
 */
export function WeekSpendingCard({
  week,
  monthExpenseMinor,
  currency,
}: WeekSpendingCardProps): React.ReactElement {
  const max = week.days.reduce(
    (top, d) => (d.totalExpenseMinor > top ? d.totalExpenseMinor : top),
    0n,
  );

  return (
    <section className="week-card" aria-labelledby="week-card-title">
      <div className="week-card-head">
        <h2 id="week-card-title" className="fin-stat-label">
          {t('week_title')}
        </h2>
        <span className="week-card-total">
          <Money amountMinor={week.weekExpenseMinor} currency={currency} />
        </span>
      </div>

      <ol className="week-bars">
        {week.days.map((d) => {
          // Read at midday UTC: the key is already the local day.
          const date = `${d.day}T12:00:00Z`;
          const share =
            d.totalExpenseMinor > 0n
              ? Math.max(MIN_BAR_SHARE, Number(d.totalExpenseMinor) / Number(max))
              : 0;
          const state =
            d.day === week.today ? ' week-bar--today' : d.day > week.today ? ' week-bar--future' : '';

          return (
            <li key={d.day} className={`week-bar${state}`}>
              <span className="week-bar-track" aria-hidden="true">
                <span
                  className="week-bar-fill"
                  style={{ '--bar-share': share } as React.CSSProperties}
                />
              </span>
              <span className="week-bar-day" aria-hidden="true">
                {formatDate(date, 'UTC', 'es', { weekday: 'narrow' })}
              </span>
              <span className="sr-only">
                {formatDate(date, 'UTC', 'es', { weekday: 'long' })}:{' '}
                <Money amountMinor={d.totalExpenseMinor} currency={currency} />
              </span>
            </li>
          );
        })}
      </ol>

      <div className="week-card-foot">
        <div className="week-card-stat">
          <span className="fin-stat-label">{t('day_today')}</span>
          <span className="week-card-stat-value">
            <Money amountMinor={week.todayExpenseMinor} currency={currency} />
          </span>
        </div>
        <div className="week-card-stat">
          <span className="fin-stat-label">{t('month_this')}</span>
          <span className="week-card-stat-value">
            <Money amountMinor={monthExpenseMinor} currency={currency} />
          </span>
        </div>
      </div>
    </section>
  );
}
