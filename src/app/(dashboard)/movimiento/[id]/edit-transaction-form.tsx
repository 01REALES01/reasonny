'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

import {
  deleteTransactionAction,
  editTransactionAction,
} from '@/app/actions/edit-transaction';
import { CategoryPicker } from '@/components/dashboard/category-picker';
import { CreateCategoryDrawer } from '@/components/dashboard/create-category-drawer';
import { AnimatedCheck } from '@/components/ui/animated-check';
import { CategoryIcon } from '@/components/ui/category-icon';
import { toDecimalString } from '@/core/money';
import type { CategoryRow } from '@/core/repositories/category.repository';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';
import { formatDate, formatTime, t } from '@/lib/i18n';

interface EditTransactionFormProps {
  readonly transaction: EnrichedTransactionRow;
  readonly categories: CategoryRow[];
  /** The profile's zone. Dates are grouped in it, so they must be read in it. */
  readonly timeZone: string;
}

export function EditTransactionForm({
  transaction,
  categories,
  timeZone,
}: EditTransactionFormProps): React.ReactElement {
  const router = useRouter();

  // The amount is seeded as a plain decimal, not through formatMoney: the field
  // feeds parseMoney back on the server, so grouping separators here would only
  // be something the user has to delete before typing.
  //
  // toDecimalString rather than `amountMinor / 100n`, which is BIGINT DIVISION
  // and truncates: a transaction of 45.50 opened as "45", and saving after
  // correcting only the note silently rewrote it as 45.00. The user destroyed
  // fifty cents by editing a field they never touched.
  //
  // The trailing ".00" is trimmed because pesos have no cents in practice and
  // the field is typed into far more often than it is read. A real fraction
  // survives, which is the half that matters.
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [amount, setAmount] = useState(() => {
    const decimal = toDecimalString(transaction.amountMinor);
    return decimal.endsWith('.00') ? decimal.slice(0, -3) : decimal;
  });
  const [categoryList, setCategoryList] = useState<CategoryRow[]>(categories);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction.category?.id ?? null,
  );
  const [note, setNote] = useState(transaction.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isIncome = transaction.type === 'income';
  const selectable = categoryList.filter((c) =>
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
        setIsSaved(true);
        window.setTimeout(() => {
          router.push('/dashboard');
        }, 650);
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
          {formatDate(transaction.transactionDate, timeZone, 'es', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          · {formatTime(transaction.transactionDate, timeZone)}
        </span>
      </div>

      <div className="step-slide entry-card">
        <div className="entry-header-row">
          <h1 className="profile-heading">{t('edit_title')}</h1>
          {transaction.source === 'sms_shortcut' ? (
            <span className="entry-source-badge entry-source-badge--auto">
              <span>Auto</span>
            </span>
          ) : (
            <span className="entry-source-badge">
              <span>Manual</span>
            </span>
          )}
        </div>

        {isSaved && (
          <div role="status" className="entry-banner entry-banner--success">
            <span className="entry-banner-msg">
              <AnimatedCheck size={20} />
              <span>{t('transaction_updated_success')}</span>
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            {error}
          </div>
        )}

        {/* Timestamp de Pago visible y destacado dentro del movimiento */}
        <div className="entry-tx-timestamp-card">
          <div className="entry-tx-timestamp-icon" aria-hidden="true">
            <CategoryIcon name="Calendar" size={16} />
          </div>
          <div className="entry-tx-timestamp-info">
            <span className="entry-tx-timestamp-label">Fecha y hora del pago</span>
            <span className="entry-tx-timestamp-value">
              {formatDate(transaction.transactionDate, timeZone, 'es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              a las {formatTime(transaction.transactionDate, timeZone)}
            </span>
          </div>
        </div>

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
            <CategoryPicker
              categories={selectable}
              selectedId={categoryId}
              onSelect={(id) => setCategoryId(categoryId === id ? null : id)}
              onAddNew={() => setIsCategoryDrawerOpen(true)}
              ariaLabel={t('field_category')}
            />
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

          <button
            type="submit"
            disabled={isPending || isSaved}
            className={`entry-submit${isSaved ? ' entry-submit--saved' : ''}`}
          >
            {isPending ? (
              t('saving')
            ) : isSaved ? (
              <span className="entry-submit-success">
                <AnimatedCheck size={18} />
                <span>¡Guardado con éxito!</span>
              </span>
            ) : (
              t('save')
            )}
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

      {/* ── Bottom Drawer para Crear Nueva Categoría dentro de Movimiento ────── */}
      <CreateCategoryDrawer
        isOpen={isCategoryDrawerOpen}
        type={isIncome ? 'income' : 'expense'}
        onClose={() => setIsCategoryDrawerOpen(false)}
        onCategoryCreated={(newCat) => {
          setCategoryList((prev) => [newCat, ...prev]);
          setCategoryId(newCat.id);
          setIsCategoryDrawerOpen(false);
        }}
      />
    </div>
  );
}
