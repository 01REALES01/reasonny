import React from 'react';

import { t } from '@/lib/i18n';
import { Money } from '@/components/ui/money';
import type { CategorySpendingBreakdown } from '@/core/repositories/transaction.repository';

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
 * Segmented progress bar and category breakdown (DESIGN_SYSTEM.md 6.6).
 */
export function CategoryBreakdown({
  breakdown,
  totalExpenseMinor,
  currency,
}: CategoryBreakdownProps): React.ReactElement | null {
  if (breakdown.length === 0 || totalExpenseMinor <= 0n) {
    return null;
  }

  const totalNum = Number(totalExpenseMinor);

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <h3 style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--ink-primary)' }}>
        {t('breakdown_title')}
      </h3>

      {/* Segmented bar */}
      <div
        style={{
          display: 'flex',
          height: '8px',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-overlay)',
          gap: '2px',
        }}
      >
        {breakdown.map((item, idx) => {
          const pct = Math.max(1, Math.round((Number(item.totalMinor) / totalNum) * 100));
          const color = item.categoryColor || CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length] || 'var(--cat-1)';
          return (
            <div
              key={item.categoryId ?? `cat-${idx}`}
              title={`${item.categoryName}: ${pct}%`}
              style={{
                width: `${pct}%`,
                backgroundColor: color,
                borderRadius: 'var(--radius-full)',
              }}
            />
          );
        })}
      </div>

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {breakdown.slice(0, 5).map((item, idx) => {
          const pct = Math.round((Number(item.totalMinor) / totalNum) * 100);
          const color = item.categoryColor || CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length] || 'var(--cat-1)';
          return (
            <div
              key={item.categoryId ?? `legend-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--text-label)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
                <span style={{ color: 'var(--ink-primary)' }}>{item.categoryName}</span>
                <span style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-caption)' }}>
                  ({pct}%)
                </span>
              </div>
              <div style={{ fontWeight: 500 }}>
                <Money
                  amountMinor={item.totalMinor}
                  currency={currency}
                  showFractionDeEmphasis={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
