'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

import { categorizeTransactionAction } from '@/app/actions/edit-transaction';
import { CategoryPicker } from '@/components/dashboard/category-picker';
import { CreateCategoryDrawer } from '@/components/dashboard/create-category-drawer';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { CategoryRow } from '@/core/repositories/category.repository';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, formatTime, t } from '@/lib/i18n';

interface ReviewQueueProps {
  readonly transactions: EnrichedTransactionRow[];
  readonly categories: CategoryRow[];
  /** The profile's zone. Dates are grouped in it, so they must be read in it. */
  readonly timeZone: string;
}

export function ReviewQueue({
  transactions,
  categories,
  timeZone,
}: ReviewQueueProps): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [categoryList, setCategoryList] = useState<CategoryRow[]>(categories);
  const [targetTxForNewCategory, setTargetTxForNewCategory] = useState<EnrichedTransactionRow | null>(null);
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
          const selectable = categoryList.filter((c) =>
            isIncome ? c.type === 'income' : c.type === 'expense',
          );

          return (
            <div key={tx.id} className="review-card">
              <div className="review-card-head">
                {/* The tile is where the chosen category's icon will sit, so
                    the row does not reflow the moment one is picked. */}
                <span className="review-card-mark" aria-hidden="true">
                  <CategoryIcon name="Tag" size={18} />
                </span>

                <div className="review-card-id">
                  <span className="review-card-merchant">{tx.merchant}</span>
                  <div className="review-card-meta">
                    <span className="review-card-date">
                      {formatDate(tx.transactionDate, timeZone, 'es', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {formatTime(tx.transactionDate, timeZone)}
                    </span>
                    {tx.source === 'sms_shortcut' && (
                      <span className="phone-tx-source-badge">Auto</span>
                    )}
                  </div>
                </div>

                <span
                  className={`review-card-amount${
                    isIncome ? ' review-card-amount--income' : ''
                  }`}
                >
                  <Money amountMinor={tx.amountMinor} currency={tx.currency} />
                </span>
              </div>

              <div className="review-card-pick">
                <span className="entry-label">{t('field_category')}</span>
                <CategoryPicker
                  categories={selectable}
                  selectedId={null}
                  onSelect={(categoryId) => assign(tx.id, categoryId)}
                  onAddNew={() => setTargetTxForNewCategory(tx)}
                  disabled={isPending}
                  ariaLabel={`Categoría para ${tx.merchant}`}
                />
              </div>

              <Link href={`/movimiento/${tx.id}`} className="review-card-edit">
                {t('review_open_detail')}
                <CategoryIcon name="ArrowRight" size={13} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Drawer para Crear Nueva Categoría desde /revisar ─────────── */}
      <CreateCategoryDrawer
        isOpen={targetTxForNewCategory !== null}
        type={targetTxForNewCategory?.type === 'income' ? 'income' : 'expense'}
        onClose={() => setTargetTxForNewCategory(null)}
        onCategoryCreated={(newCat) => {
          setCategoryList((prev) => [newCat, ...prev]);
          if (targetTxForNewCategory) {
            assign(targetTxForNewCategory.id, newCat.id);
          }
          setTargetTxForNewCategory(null);
        }}
      />
    </div>
  );
}
