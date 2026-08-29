import React from 'react';

import { Money } from '@/components/ui/money';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, t } from '@/lib/i18n';

interface TransactionItemProps {
  readonly transaction: EnrichedTransactionRow;
}

/**
 * Transaction row item (DESIGN_SYSTEM.md 6.3).
 *
 * Touch target >= 44px, tabular numbers, and uncategorized warning dot.
 */
export function TransactionItem({
  transaction,
}: TransactionItemProps): React.ReactElement {
  const isIncome = transaction.type === 'income';
  const isUncategorized = !transaction.category;

  const categoryName = transaction.category?.name ?? t('uncategorized');
  const timeFormatted = formatDate(transaction.transactionDate, 'es', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '48px',
        padding: 'var(--space-2) 0',
      }}
    >
      {/* Icon + Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: transaction.category?.color ?? 'var(--ink-secondary)',
          }}
        >
          {isIncome ? '↓' : '☕'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isUncategorized && (
              <span
                title={t('uncategorized')}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--warning)',
                  display: 'inline-block',
                }}
              />
            )}
            <span
              style={{
                fontSize: 'var(--text-body)',
                fontWeight: 500,
                color: 'var(--ink-primary)',
              }}
            >
              {transaction.merchant}
            </span>
          </div>

          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>
            {categoryName} · {timeFormatted}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          color: isIncome ? 'var(--positive)' : 'var(--ink-primary)',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {isIncome ? '+' : ''}
          <Money
            amountMinor={transaction.amountMinor}
            currency={transaction.currency}
          />
        </span>
      </div>
    </div>
  );
}
