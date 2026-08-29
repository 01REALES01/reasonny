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
 *
 * Styled by class rather than inline, unlike the static cards beside it: this
 * is the row the list repeats, so every style object here was ten fresh objects
 * per transaction on a screen whose whole budget is INP.
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
    <div className="tx">
      {/* Icon + Details */}
      <div className="tx-lead">
        <div
          className="tx-icon"
          aria-hidden="true"
          // Per-row value from the database, so it cannot be a class. Same
          // custom-property handoff as the category chips in the entry form.
          style={
            (transaction.category?.color
              ? { '--tx-icon-ink': transaction.category.color }
              : {}) as React.CSSProperties
          }
        >
          {isIncome ? '↓' : '☕'}
        </div>

        <div className="tx-detail">
          <div className="tx-merchant">
            {isUncategorized && <span className="tx-flag" title={t('uncategorized')} />}
            <span className="tx-name">{transaction.merchant}</span>
          </div>

          <span className="tx-meta">
            {categoryName} · {timeFormatted}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className={`tx-amount${isIncome ? ' tx-amount--income' : ''}`}>
        <span>
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
