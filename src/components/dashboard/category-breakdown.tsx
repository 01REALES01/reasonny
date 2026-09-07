import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { CategorySpendingBreakdown } from '@/core/repositories/transaction.repository';
import { t } from '@/lib/i18n';

interface CategoryBreakdownProps {
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
 * Segmented bar and category breakdown (DESIGN_SYSTEM.md 6.6).
 *
 * Percentages are computed once, in one place. They used to be computed twice
 * with different rounding - the bar clamped to a minimum of 1% and the legend
 * did not - so a category under 0.5% read "1%" in the tooltip and "0%" in the
 * list directly below it.
 *
 * The bar distributes with flex-grow rather than percentage widths. With
 * `width: N%` on every segment plus a 2px gap between them the row always added
 * up to more than 100% and the last segment was silently clipped, which is the
 * worst possible failure for a chart: the smallest category disappears.
 */
export function CategoryBreakdown({
  breakdown,
  totalExpenseMinor,
  currency,
}: CategoryBreakdownProps): React.ReactElement {
  if (breakdown.length === 0 || totalExpenseMinor <= 0n) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            <strong>{t('breakdown_title')}</strong>
          </h2>
        </div>
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
    name: item.categoryName ?? t('uncategorized'),
    icon: item.categoryIcon,
    // The repository returns null for the uncategorised bucket rather than a
    // label; naming it belongs here, through the catalog.
    color:
      item.categoryColor ||
      CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length] ||
      'var(--cat-1)',
    share: Number(item.totalMinor) / totalNum,
    pct: Math.round((Number(item.totalMinor) / totalNum) * 100),
    totalMinor: item.totalMinor,
  }));

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">
          <strong>{t('breakdown_title')}</strong>
        </h2>
      </div>

      <div className="breakdown-bar">
        {slices.map((slice) => (
          <span
            key={slice.key}
            className="breakdown-seg"
            title={`${slice.name}: ${slice.pct}%`}
            style={
              {
                flexGrow: slice.share,
                '--seg-ink': slice.color,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <ul className="breakdown-list">
        {slices.slice(0, 5).map((slice) => (
          <li key={slice.key} className="breakdown-row">
            <span
              className="breakdown-dot"
              style={{ '--seg-ink': slice.color } as React.CSSProperties}
            />
            {slice.icon && (
              <span
                style={
                  {
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: slice.color,
                  } as React.CSSProperties
                }
                aria-hidden="true"
              >
                <CategoryIcon name={slice.icon} size={13} />
              </span>
            )}
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
