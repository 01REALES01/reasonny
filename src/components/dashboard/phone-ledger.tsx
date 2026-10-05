import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { DayGroup } from '@/core/services/analytics.service';
import { formatDate, formatTime, t } from '@/lib/i18n';

interface PhoneLedgerProps {
  readonly days: DayGroup[];
  readonly currency: string;
  readonly timeZone?: string | undefined;
  readonly activeAccountFilterName?: string | null | undefined;
  readonly onClearAccountFilter?: (() => void) | undefined;
}

/**
 * Transactions under one header per day, the way a fixtures list reads:
 * the date first, then what happened on it, with the day's spending beside it.
 */
export function PhoneLedger({
  days,
  currency,
  timeZone = 'America/Bogota',
  activeAccountFilterName,
  onClearAccountFilter,
}: PhoneLedgerProps): React.ReactElement {
  return (
    <section className="phone-ledger">
      {/* Header */}
      <div className="phone-ledger-header">
        <h2 className="phone-ledger-title">{t('dashboard_recent_title')}</h2>
        <Link href="/mes" className="phone-ledger-view-all">
          {t('month_view')}
        </Link>
      </div>

      {/* Active Account Filter Banner */}
      {activeAccountFilterName && (
        <div className="phone-ledger-filter-banner" role="status" aria-live="polite">
          <div className="phone-ledger-filter-pill">
            <span className="phone-ledger-filter-dot" aria-hidden="true" />
            <span className="phone-ledger-filter-txt">
              {t('ledger_filter_showing')} <strong>{activeAccountFilterName}</strong>
            </span>
          </div>
          {onClearAccountFilter && (
            <button
              type="button"
              onClick={onClearAccountFilter}
              className="phone-ledger-clear-btn"
              title={t('ledger_filter_clear')}
              aria-label={t('ledger_filter_clear')}
            >
              <span>{t('ledger_filter_clear_short')} ✕</span>
            </button>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div className="phone-ledger-empty">
          <div className="phone-ledger-empty-icon" aria-hidden="true">
            <CategoryIcon name="Sparkles" size={24} />
          </div>
          <p className="phone-ledger-empty-text">
            {activeAccountFilterName
              ? `${t('ledger_filter_empty')} ${activeAccountFilterName}.`
              : t('dashboard_empty')}
          </p>
          {activeAccountFilterName && onClearAccountFilter ? (
            <button
              type="button"
              onClick={onClearAccountFilter}
              className="phone-ledger-empty-cta-btn"
            >
              {t('ledger_filter_clear')} →
            </button>
          ) : (
            <Link href="/nuevo" className="phone-ledger-empty-cta">
              <span>{t('dashboard_empty_cta')}</span>
              <span className="phone-ledger-empty-arrow" aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="phone-ledger-list">
          {days.map((group) => (
            <section key={group.day} className="ledger-day">
              <header className="ledger-day-header">
                <h3 className="ledger-day-label">
                  {group.relative === 'today'
                    ? t('day_today')
                    : group.relative === 'yesterday'
                      ? t('day_yesterday')
                      : // The key is already the local day, so it is read back
                        // at midday UTC: no zone can move it across midnight.
                        // 'es' for the same reason the rows used it - the
                        // surrounding UI is Spanish.
                        formatDate(`${group.day}T12:00:00Z`, 'UTC', 'es', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                        })}
                </h3>
                {group.totalExpenseMinor > 0n && (
                  <span className="ledger-day-total">
                    -<Money amountMinor={group.totalExpenseMinor} currency={currency} />
                  </span>
                )}
              </header>

              {group.transactions.map((tx) => {
                const isIncome = tx.type === 'income';

                // The row is a link: a spend recorded with the wrong category
                // or a typo in the merchant used to be permanent, because
                // there was nowhere to open it from.
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
                          <span className="phone-tx-time">
                            {formatTime(tx.transactionDate, timeZone)}
                          </span>
                          <span className="phone-tx-sep">·</span>
                          <span className="phone-tx-cat">
                            {tx.category?.name ?? t('uncategorized')}
                          </span>
                          {tx.source === 'sms_shortcut' && (
                            <span
                              className="phone-tx-source-badge"
                              title="Capturado automáticamente vía SMS"
                            >
                              Auto
                            </span>
                          )}
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
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
