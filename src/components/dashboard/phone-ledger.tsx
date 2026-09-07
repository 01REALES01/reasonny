import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, t } from '@/lib/i18n';

interface PhoneLedgerProps {
  readonly transactions: EnrichedTransactionRow[];
}

/**
 * Obsidian Ledger matching Reference Photo 1:
 * - "Recent Transactions" title in warm champagne gold + "View All" on right.
 * - Circular icon tiles (44px) for each merchant.
 * - Merchant name in bold, relative time subline.
 * - Tabular amounts on right (negative for expense, positive green for income).
 */
export function PhoneLedger({ transactions }: PhoneLedgerProps): React.ReactElement {
  return (
    <section className="phone-ledger">
      {/* Header */}
      <div className="phone-ledger-header">
        <h2 className="phone-ledger-title">{t('dashboard_recent_title')}</h2>
        <Link href="/mes" className="phone-ledger-view-all">
          {t('month_view')}
        </Link>
      </div>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <div className="phone-ledger-empty">
          <p>{t('dashboard_empty')}</p>
          <Link href="/nuevo" className="phone-ledger-empty-cta">
            {t('dashboard_empty_cta')} →
          </Link>
        </div>
      ) : (
        <div className="phone-ledger-list">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';
            const categoryName = tx.category?.name ?? t('uncategorized');
            // 'es', not 'en': the surrounding UI is Spanish, and an English
            // month abbreviation next to "Restaurantes y Café" is the kind of
            // detail that makes a product feel translated rather than built.
            const timeFormatted = formatDate(tx.transactionDate, 'es', {
              month: 'short',
              day: 'numeric',
            });

            // The row is a link now: a spend recorded with the wrong category
            // or a typo in the merchant used to be permanent, because there was
            // nowhere to open it from.
            return (
              <Link key={tx.id} href={`/movimiento/${tx.id}`} className="phone-tx-row">
                <div className="phone-tx-lead">
                  <div
                    className="phone-tx-icon"
                    style={
                      (tx.category?.color
                        ? { '--tx-icon-ink': tx.category.color }
                        : {}) as React.CSSProperties
                    }
                  >
                    <CategoryIcon
                      name={isIncome ? 'TrendingUp' : tx.category?.icon}
                      size={18}
                    />
                  </div>

                  <div className="phone-tx-info">
                    <span className="phone-tx-merchant">{tx.merchant}</span>
                    <span className="phone-tx-meta">
                      {categoryName} · {timeFormatted}
                    </span>
                  </div>
                </div>

                <div
                  className={`phone-tx-amount${
                    isIncome ? ' phone-tx-amount--income' : ''
                  }`}
                >
                  <span>
                    {isIncome ? '+' : '-'}
                    <Money amountMinor={tx.amountMinor} currency={tx.currency} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
