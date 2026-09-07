import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { CategorySpendingBreakdown } from '@/core/repositories/transaction.repository';
import { t } from '@/lib/i18n';

interface CategoryBreakdownPanelProps {
  readonly breakdown: CategorySpendingBreakdown[];
  readonly totalExpenseMinor: bigint;
  readonly currency: string;
}

const CATEGORICAL_COLORS = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
  'var(--cat-6)',
];

/**
 * Spending by category for one month (DESIGN_SYSTEM.md 6.6).
 *
 * Percentages are computed once. Computing them twice with different rounding
 * is how the same category ends up reading 1% in the bar and 0% in the list
 * directly under it.
 *
 * The bar distributes with flex-grow rather than percentage widths: `width: N%`
 * on each segment plus a gap between them always sums past 100%, and the
 * overflow is silently clipped off the end - which loses the smallest category,
 * the one most worth noticing.
 */
export function CategoryBreakdownPanel({
  breakdown,
  totalExpenseMinor,
  currency,
}: CategoryBreakdownPanelProps): React.ReactElement {
  if (breakdown.length === 0 || totalExpenseMinor <= 0n) {
    return (
      <section className="breakdown-panel">
        <h2 className="breakdown-panel-title">{t('breakdown_title')}</h2>
        <div className="breakdown-empty">
          <p>{t('breakdown_empty')}</p>
          <span className="breakdown-empty-hint">{t('breakdown_empty_hint')}</span>
        </div>
      </section>
    );
  }

  const totalNum = Number(totalExpenseMinor);

  const slices = breakdown.map((item, idx) => ({
    key: item.categoryId ?? `cat-${idx}`,
    // The repository returns null for the uncategorised bucket rather than a
    // label; naming it belongs here, through the catalog.
    name: item.categoryName ?? t('uncategorized'),
    icon: item.categoryIcon,
    color:
      item.categoryColor ||
      CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length] ||
      'var(--cat-1)',
    share: Number(item.totalMinor) / totalNum,
    pct: Math.round((Number(item.totalMinor) / totalNum) * 100),
    totalMinor: item.totalMinor,
  }));

  return (
    <section className="breakdown-panel">
      <h2 className="breakdown-panel-title">{t('breakdown_title')}</h2>

      <div className="breakdown-bar">
        {slices.map((slice) => (
          <span
            key={slice.key}
            className="breakdown-seg"
            title={`${slice.name}: ${slice.pct}%`}
            style={
              { flexGrow: slice.share, '--seg-ink': slice.color } as React.CSSProperties
            }
          />
        ))}
      </div>

      <ul className="breakdown-list">
        {slices.slice(0, 6).map((slice) => (
          <li key={slice.key} className="breakdown-row">
            <span
              className="breakdown-icon"
              style={{ '--seg-ink': slice.color } as React.CSSProperties}
              aria-hidden="true"
            >
              <CategoryIcon name={slice.icon} size={14} />
            </span>
            <span className="breakdown-name">{slice.name}</span>
            <span className="breakdown-pct">{slice.pct}%</span>
            <span className="breakdown-amount">
              <Money
                amountMinor={slice.totalMinor}
                currency={currency}
                showFractionDeEmphasis={false}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
