'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState, useTransition } from 'react';

import { createQuickTransactionAction } from '@/app/actions/transactions';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { parseMoney } from '@/core/money';
import type { AccountRow } from '@/core/repositories/account.repository';
import type { CategoryRow } from '@/core/repositories/category.repository';
import { t } from '@/lib/i18n';
import { reportManualEntryDuration, startTiming } from '@/lib/telemetry';

interface QuickAddFormProps {
  readonly accounts: AccountRow[];
  readonly categories: CategoryRow[];
  readonly initialType?: 'expense' | 'income';
}

const QUICK_AMOUNTS = ['10000', '20000', '50000', '100000'];

export function QuickAddForm({
  accounts,
  categories,
  initialType = 'expense',
}: QuickAddFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<'expense' | 'income'>(initialType);
  const [amountInput, setAmountInput] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const stopTimingRef = useRef<(() => number) | null>(null);

  useEffect(() => {
    stopTimingRef.current = startTiming();
  }, []);

  const filteredCategories = categories.filter((c) => c.type === type);

  // Derive preview amount in minor units for live Money formatting
  let previewMinor = 0n;
  try {
    if (amountInput.trim()) {
      previewMinor = parseMoney(amountInput, 'COP').minor;
    }
  } catch {
    previewMinor = 0n;
  }

  function handleQuickSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!amountInput.trim()) {
      setError(t('validation_amount_positive'));
      return;
    }

    if (!merchant.trim()) {
      setError(t('validation_merchant_required'));
      return;
    }

    startTransition(async () => {
      const result = await createQuickTransactionAction({
        amount: amountInput,
        merchant,
        type,
        categoryId: selectedCategoryId,
        accountId: selectedAccountId || null,
        note: note.trim() || null,
      });

      if (!result.success) {
        setError(result.error ?? t('error_generic'));
      } else {
        const elapsedMs = stopTimingRef.current?.();
        if (elapsedMs !== undefined) {
          reportManualEntryDuration(elapsedMs);
        }
        stopTimingRef.current = startTiming();

        setSuccess(true);
        setAmountInput('');
        setMerchant('');
        setNote('');
        setSelectedCategoryId(null);
      }
    });
  }

  const isIncome = type === 'income';

  return (
    <div className="entry">
      {/* Top navigation bar */}
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{t('back')}</span>
        </Link>

        {/* Segmented Control (Gasto / Ingreso) */}
        <div role="group" aria-label={t('transaction_type')} className="entry-segmented">
          <button
            type="button"
            aria-pressed={!isIncome}
            onClick={() => {
              setType('expense');
              setSelectedCategoryId(null);
            }}
            className="entry-segment"
          >
            {t('field_type_expense')}
          </button>
          <button
            type="button"
            aria-pressed={isIncome}
            onClick={() => {
              setType('income');
              setSelectedCategoryId(null);
            }}
            className="entry-segment entry-segment--income"
          >
            {t('field_type_income')}
          </button>
        </div>
      </div>

      {/* Main Luxury Entry Container */}
      <div className="step-slide entry-card">
        {success && (
          <div role="status" className="entry-banner entry-banner--success">
            <span>✓ {t('transaction_created_success')}</span>
            <Link href="/dashboard">
              {t('view_on_home')} <CategoryIcon name="ArrowRight" size={13} />
            </Link>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleQuickSubmit} className="entry-form">
          {/* Monumental Hero Amount Section */}
          <div className="entry-hero-section">
            <label htmlFor="amount" className="entry-hero-label">
              {isIncome ? 'Monto a ingresar' : 'Monto del gasto'} (COP)
            </label>

            <div className={`entry-hero-input-wrap${isIncome ? ' entry-hero-input-wrap--income' : ''}`}>
              <span className="entry-hero-currency">$</span>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="entry-hero-input"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="entry-chips">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmountInput(val)}
                  className="entry-chip"
                >
                  +
                  <Money
                    amountMinor={parseMoney(val, 'COP').minor}
                    currency="COP"
                    showFractionDeEmphasis={false}
                  />
                </button>
              ))}
            </div>

            {previewMinor > 0n && (
              <div className={`entry-preview${isIncome ? ' entry-preview--income' : ''}`}>
                <span>{t('field_amount_preview')}: </span>
                <strong>
                  <Money amountMinor={previewMinor} currency="COP" />
                </strong>
              </div>
            )}
          </div>

          {/* Field 1: Merchant / Concepto */}
          <div className="entry-field">
            <label htmlFor="merchant" className="entry-label">
              {t('field_merchant')}
            </label>
            <input
              id="merchant"
              name="merchant"
              type="text"
              placeholder={isIncome ? 'Ej. Salario, Rendimiento, Pago' : t('field_merchant_placeholder')}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
              className="entry-input"
            />
          </div>

          {/* Field 2: Category Selector with Squircle Tiles */}
          <div className="entry-field">
            <label className="entry-label">{t('field_category')}</label>
            <div className="entry-categories">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                    className="entry-category-tile"
                    style={
                      (cat.color ? { '--cat-tile-ink': cat.color } : {}) as React.CSSProperties
                    }
                  >
                    <div className="entry-category-tile-icon">
                      <CategoryIcon name={cat.icon} size={18} />
                    </div>
                    <span className="entry-category-tile-name">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Selector (if multiple accounts) */}
          {accounts.length > 1 && (
            <div className="entry-field">
              <label htmlFor="account" className="entry-label">
                {t('field_account')}
              </label>
              <select
                id="account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="entry-select"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Note */}
          <div className="entry-field">
            <label htmlFor="note" className="entry-label">
              {t('field_note')}
            </label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder={t('field_note_placeholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="entry-input"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className={`entry-submit${isIncome ? ' entry-submit--income' : ''}`}
          >
            {isPending
              ? t('saving')
              : isIncome
              ? '+ Registrar Ingreso'
              : '+ Registrar Gasto'}
          </button>
        </form>
      </div>
    </div>
  );
}

