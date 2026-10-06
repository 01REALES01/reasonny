'use client';

import React, { useState, useTransition } from 'react';

import { deleteAccountAction } from '@/app/actions/privacy';
import { t } from '@/lib/i18n';

/**
 * The right to deletion (Ley 1581, art. 8 e), in the app rather than only by
 * email. Same two-step shape as deleting one transaction, plus a typed word:
 * this one erases everything, and a mistaken tap must not be enough.
 */
export function DeleteAccountSection(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const word = t('account_delete_confirm_word');
  const matches = typed.trim().toUpperCase() === word;

  function confirm(): void {
    setFailed(false);
    startTransition(async () => {
      const result = await deleteAccountAction(typed);
      if (!result.success) {
        setFailed(true);
        return;
      }
      window.location.assign('/');
    });
  }

  return (
    <section className="danger-zone account-delete">
      <h2 className="account-delete-title">{t('account_delete_title')}</h2>
      <p className="account-delete-text">{t('account_delete_text')}</p>

      {open ? (
        <>
          <label htmlFor="account-delete-word" className="account-delete-prompt">
            {t('account_delete_confirm_prompt')} <strong>{word}</strong>
          </label>
          <input
            id="account-delete-word"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="entry-input"
          />
          {failed && (
            <div role="alert" className="auth-error">
              ⚠ {t('account_delete_failed')}
            </div>
          )}
          <div className="danger-zone-actions">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
              disabled={isPending}
              className="danger-cancel"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!matches || isPending}
              className="danger-confirm"
            >
              {isPending ? t('account_delete_deleting') : t('account_delete_confirm')}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="danger-trigger">
          {t('account_delete_title')}
        </button>
      )}
    </section>
  );
}
