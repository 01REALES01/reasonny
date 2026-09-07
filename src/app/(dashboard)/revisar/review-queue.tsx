'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

import { categorizeTransactionAction } from '@/app/actions/edit-transaction';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { CategoryRow } from '@/core/repositories/category.repository';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, t } from '@/lib/i18n';

interface ReviewQueueProps {
  readonly transactions: EnrichedTransactionRow[];
  readonly categories: CategoryRow[];
}

export function ReviewQueue({
  transactions,
  categories,
}: ReviewQueueProps): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Rows are hidden as soon as their write succeeds instead of waiting for the
  // refresh, so clearing a queue of twenty does not mean twenty round trips of
  // watching the same list not change.
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const pending = transactions.filter((tx) => !done.has(tx.id));

  function assign(transactionId: string, categoryId: string): void {
    setError(null);
    startTransition(async () => {
      const result = await categorizeTransactionAction(transactionId, categoryId);
      if (result.success) {
        setDone((prev) => new Set(prev).add(transactionId));
        router.refresh();
      } else {
        setError(result.error ?? null);
      }
    });
  }

  if (pending.length === 0) {
    return (
      <div className="review-clear">
        <span className="review-clear-mark" aria-hidden="true">
          <CategoryIcon name="ShieldCheck" size={26} />
        </span>
        <h1 className="profile-heading">{t('review_clear_title')}</h1>
        <p className="review-clear-text">{t('review_clear_text')}</p>
        <Link href="/dashboard" className="fin-action-btn fin-action-btn--secondary">
          {t('review_back_home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="entry">
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{t('back')}</span>
        </Link>
        <span className="entry-date-chip">
          {pending.length} {t('dashboard_pending_review')}
        </span>
      </div>

      <h1 className="profile-heading">{t('review_title')}</h1>
      <p className="review-lede">{t('review_lede')}</p>

      {error && (
        <div role="alert" className="entry-banner entry-banner--error">
          {error}
        </div>
      )}

      <div className="review-list">
        {pending.map((tx) => {
          const isIncome = tx.type === 'income';
          const selectable = categories.filter((c) =>
            isIncome ? c.type === 'income' : c.type === 'expense',
          );

          return (
            <div key={tx.id} className="review-card">
              <div className="review-card-head">
                <div className="review-card-id">
                  <span className="review-card-merchant">{tx.merchant}</span>
                  <span className="review-card-date">
                    {formatDate(tx.transactionDate, 'es', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <span
                  className={`review-card-amount${
                    isIncome ? ' review-card-amount--income' : ''
                  }`}
                >
                  <Money amountMinor={tx.amountMinor} currency={tx.currency} />
                </span>
              </div>

              <div className="entry-categories">
                {selectable.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => assign(tx.id, cat.id)}
                    className="entry-category"
                  >
                    <span
                      className="entry-category-dot"
                      style={{ '--dot': cat.color } as React.CSSProperties}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>

              <Link href={`/movimiento/${tx.id}`} className="review-card-edit">
                {t('review_open_detail')}
                <CategoryIcon name="ArrowRight" size={13} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
