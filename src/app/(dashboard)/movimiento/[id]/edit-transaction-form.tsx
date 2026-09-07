'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

import {
  deleteTransactionAction,
  editTransactionAction,
} from '@/app/actions/edit-transaction';
import { CategoryIcon } from '@/components/ui/category-icon';
import type { CategoryRow } from '@/core/repositories/category.repository';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, t } from '@/lib/i18n';

interface EditTransactionFormProps {
  readonly transaction: EnrichedTransactionRow;
  readonly categories: CategoryRow[];
}

export function EditTransactionForm({
  transaction,
  categories,
}: EditTransactionFormProps): React.ReactElement {
  const router = useRouter();

  // The amount is seeded as a plain integer string, not through formatMoney:
  // the field feeds parseMoney back on the server, so grouping separators here
  // would only be something the user has to delete before typing.
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [amount, setAmount] = useState(String(transaction.amountMinor / 100n));
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction.category?.id ?? null,
  );
  const [note, setNote] = useState(transaction.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isIncome = transaction.type === 'income';
  const selectable = categories.filter((c) =>
    isIncome ? c.type === 'income' : c.type === 'expense',
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await editTransactionAction({
        transactionId: transaction.id,
        merchant,
        amount,
        categoryId,
        note: note || null,
      });

      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error ?? null);
      }
    });
  }

  function handleDelete(): void {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransactionAction(transaction.id);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error ?? null);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <div className="entry">
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{t('back')}</span>
        </Link>
        <span className="entry-date-chip">
          {formatDate(transaction.transactionDate, 'es', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      <div className="step-slide entry-card">
        <h1 className="profile-heading">{t('edit_title')}</h1>

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="entry-form">
          <div className="entry-field">
            <label htmlFor="edit-amount" className="entry-label">
              {t('field_amount')}
            </label>
            <input
              id="edit-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`entry-amount${isIncome ? ' entry-amount--income' : ''}`}
            />
          </div>

          <div className="entry-field">
            <label htmlFor="edit-merchant" className="entry-label">
              {t('field_merchant')}
            </label>
            <input
              id="edit-merchant"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              maxLength={255}
              className="entry-input"
            />
          </div>

          <div className="entry-field">
            <span className="entry-label">{t('field_category')}</span>
            <div className="entry-categories">
              {selectable.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={categoryId === cat.id}
                  onClick={() =>
                    setCategoryId(categoryId === cat.id ? null : cat.id)
                  }
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
          </div>

          <div className="entry-field">
            <label htmlFor="edit-note" className="entry-label">
              {t('field_note')}
            </label>
            <input
              id="edit-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              className="entry-input"
            />
          </div>

          <button type="submit" disabled={isPending} className="entry-submit">
            {isPending ? t('saving') : t('save')}
          </button>
        </form>
      </div>

      {/* Two steps on purpose. Deleting is the one action on this screen that
          the user cannot undo from the interface, so it does not share a tap
          target with anything else and it says what will happen first. */}
      <div className="danger-zone">
        {confirmingDelete ? (
          <>
            <p className="danger-zone-question">{t('delete_confirm')}</p>
            <div className="danger-zone-actions">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="danger-cancel"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="danger-confirm"
              >
                {t('delete_confirm_yes')}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="danger-trigger"
          >
            {t('delete_transaction')}
          </button>
        )}
      </div>
    </div>
  );
}
