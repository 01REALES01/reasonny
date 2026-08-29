'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState, useTransition } from 'react';

import { createQuickTransactionAction } from '@/app/actions/transactions';
import { Money } from '@/components/ui/money';
import { parseMoney } from '@/core/money';
import type { AccountRow } from '@/core/repositories/account.repository';
import type { CategoryRow } from '@/core/repositories/category.repository';
import { t } from '@/lib/i18n';
import { reportManualEntryDuration, startTiming } from '@/lib/telemetry';

interface QuickAddFormProps {
  readonly accounts: AccountRow[];
  readonly categories: CategoryRow[];
}

const QUICK_AMOUNTS = ['10000', '20000', '50000', '100000'];

export function QuickAddForm({
  accounts,
  categories,
}: QuickAddFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  /**
   * The phase-1 baseline (B9): how long a manual entry actually takes.
   *
   * The stopwatch starts when the form appears, not on first keystroke,
   * because what phase 2 will be compared against is the whole cost of
   * recording an expense by hand - including staring at the screen deciding
   * what to call the merchant. A ref rather than state: this value changes
   * without anything on screen depending on it, and putting it in state would
   * re-render the form on every entry for no visible reason (P7).
   */
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
        // Only a successful save counts. Timing an attempt that errored would
        // mix "how long entry takes" with "how long a failure takes", and the
        // baseline is meant to answer the first question.
        const elapsedMs = stopTimingRef.current?.();
        if (elapsedMs !== undefined) {
          reportManualEntryDuration(elapsedMs);
        }
        // The form stays open for another entry, so the next one is timed from
        // here rather than from the original mount.
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
        <Link href="/" className="entry-back">
          ← {t('back')}
        </Link>

        {/* Segmented Control (DESIGN_SYSTEM.md 6.4) */}
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

      {/* Main card */}
      <div className="step-slide entry-card">
        <h1 className="entry-heading">
          {isIncome ? t('record_income') : t('record_expense')}
        </h1>

        {success && (
          <div role="status" className="entry-banner entry-banner--success">
            <span>✓ {t('transaction_created_success')}</span>
            <Link href="/">{t('view_on_home')} →</Link>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleQuickSubmit} className="entry-form">
          {/* Field 1: Amount with Display & Quick Suggestions */}
          <div className="entry-field">
            <label htmlFor="amount" className="entry-label">
              {t('field_amount')} (COP)
            </label>

            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className={`entry-amount${isIncome ? ' entry-amount--income' : ''}`}
            />

            {/* Quick Amount Chips */}
            <div className="entry-chips">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmountInput(val)}
                  className="entry-chip"
                >
                  {/* Through <Money>, not toLocaleString: the chip and the
                      figure it fills in must be formatted by the same rules,
                      or the shortcut shows one number and the field another. */}
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
                {t('field_amount_preview')}{' '}
                <strong>
                  <Money amountMinor={previewMinor} currency="COP" />
                </strong>
              </div>
            )}
          </div>

          {/* Field 2: Merchant / Concept */}
          <div className="entry-field">
            <label htmlFor="merchant" className="entry-label">
              {t('field_merchant')}
            </label>
            <input
              id="merchant"
              name="merchant"
              type="text"
              placeholder={t('field_merchant_placeholder')}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
              className="entry-input"
            />
          </div>

          {/* Field 3: Category Chips */}
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
                    className="entry-category"
                  >
                    {/* The one inline style left in this file, and the reason
                        the rule allows it: cat.color is a per-row value from
                        the database, so it cannot be a class. It rides in as a
                        custom property the stylesheet reads, which keeps the
                        colour a token substitution rather than a second styling
                        mechanism. */}
                    <span
                      className="entry-category-dot"
                      style={
                        // Omitted rather than set empty when the row has no
                        // colour: var(--dot, ...) only reaches its fallback if
                        // the property is absent, so an empty string would
                        // paint nothing instead of the brand default.
                        (cat.color ? { '--dot': cat.color } : {}) as React.CSSProperties
                      }
                    />
                    {cat.name}
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
            {isPending ? t('saving') : t('btn_submit_transaction')}
          </button>
        </form>
      </div>
    </div>
  );
}
