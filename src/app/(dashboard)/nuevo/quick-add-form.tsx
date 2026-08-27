'use client';

import React, { useState, useTransition } from 'react';

import { createQuickTransactionAction } from '@/app/actions/transactions';
import { Money } from '@/components/ui/money';
import { parseMoney } from '@/core/money';
import type { AccountRow } from '@/core/repositories/account.repository';
import type { CategoryRow } from '@/core/repositories/category.repository';
import { t } from '@/lib/i18n';

interface QuickAddFormProps {
  readonly accounts: AccountRow[];
  readonly categories: CategoryRow[];
}

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
        setSuccess(true);
        setAmountInput('');
        setMerchant('');
        setNote('');
        setSelectedCategoryId(null);
      }
    });
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        boxShadow: 'var(--shadow-overlay)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      {/* Header & Segmented Expense/Income Control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--ink-primary)' }}>
          {t('quick_add_title')}
        </h1>

        {/* Segmented Control (DESIGN_SYSTEM.md 6.4) */}
        <div
          role="group"
          aria-label="Transaction Type"
          style={{
            backgroundColor: 'var(--surface-sunken)',
            borderRadius: 'var(--radius-full)',
            padding: '3px',
            display: 'inline-flex',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setType('expense');
              setSelectedCategoryId(null);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: type === 'expense' ? 'var(--ink-primary)' : 'transparent',
              color: type === 'expense' ? 'var(--ink-inverse)' : 'var(--ink-secondary)',
              fontSize: 'var(--text-label)',
              fontWeight: 600,
            }}
          >
            {t('field_type_expense')}
          </button>
          <button
            type="button"
            onClick={() => {
              setType('income');
              setSelectedCategoryId(null);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: type === 'income' ? 'var(--ink-primary)' : 'transparent',
              color: type === 'income' ? 'var(--ink-inverse)' : 'var(--ink-secondary)',
              fontSize: 'var(--text-label)',
              fontWeight: 600,
            }}
          >
            {t('field_type_income')}
          </button>
        </div>
      </div>

      {success && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(52, 199, 123, 0.14)',
            color: 'var(--positive)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-label)',
            fontWeight: 500,
          }}
        >
          ✓ {t('transaction_created_success')}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(229, 72, 77, 0.14)',
            color: 'var(--critical)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-label)',
            fontWeight: 500,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <form
        onSubmit={handleQuickSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
      >
        {/* Field 1: Amount with Hero Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label
            htmlFor="amount"
            style={{
              fontSize: 'var(--text-label)',
              color: 'var(--ink-secondary)',
              fontWeight: 500,
            }}
          >
            {t('field_amount')}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              style={{
                fontSize: 'var(--text-display)',
                fontWeight: 600,
                textAlign: 'left',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--surface-sunken)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--ink-primary)',
              }}
            />
          </div>

          {previewMinor > 0n && (
            <div style={{ color: 'var(--ink-secondary)', fontSize: 'var(--text-label)' }}>
              Vista previa: <Money amountMinor={previewMinor} currency="COP" />
            </div>
          )}
        </div>

        {/* Field 2: Merchant / Concept */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label
            htmlFor="merchant"
            style={{
              fontSize: 'var(--text-label)',
              color: 'var(--ink-secondary)',
              fontWeight: 500,
            }}
          >
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
            style={{
              fontSize: 'var(--text-body)',
              backgroundColor: 'var(--surface-sunken)',
            }}
          />
        </div>

        {/* Field 3: Category Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label
            style={{
              fontSize: 'var(--text-label)',
              color: 'var(--ink-secondary)',
              fontWeight: 500,
            }}
          >
            {t('field_category')}
          </label>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              maxHeight: '160px',
              overflowY: 'auto',
            }}
          >
            {filteredCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isSelected
                      ? 'var(--brand-500)'
                      : 'var(--surface-overlay)',
                    color: isSelected ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--brand-400)' : 'var(--border-hairline)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: cat.color || 'var(--brand-400)',
                    }}
                  />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Account Selector (if multiple accounts) */}
        {accounts.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label
              htmlFor="account"
              style={{
                fontSize: 'var(--text-label)',
                color: 'var(--ink-secondary)',
                fontWeight: 500,
              }}
            >
              {t('field_account')}
            </label>
            <select
              id="account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{ backgroundColor: 'var(--surface-sunken)' }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            backgroundColor: 'var(--brand-500)',
            color: 'var(--ink-primary)',
            padding: 'var(--space-4)',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-3)',
            width: '100%',
          }}
        >
          {isPending ? t('saving') : t('btn_submit_transaction')}
        </button>
      </form>
    </div>
  );
}
