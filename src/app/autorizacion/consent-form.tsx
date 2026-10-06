'use client';

import Link from 'next/link';
import React, { useState, useTransition } from 'react';

import { acceptPolicyAction } from '@/app/actions/privacy';
import { PRIVACY_CONTACT_EMAIL } from '@/content/privacy-policy';
import { getAuthClient } from '@/lib/auth-client';
import { t } from '@/lib/i18n';

export function ConsentForm(): React.ReactElement {
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function accept(): void {
    setFailed(false);
    startTransition(async () => {
      const result = await acceptPolicyAction();
      if (!result.success) {
        setFailed(true);
        return;
      }
      // A full load, not router.push: the gate lives in a layout, and a
      // client navigation would reuse the one that sent us here.
      window.location.assign('/dashboard');
    });
  }

  function decline(): void {
    startTransition(async () => {
      await getAuthClient()
        .signOut()
        .catch(() => undefined);
      window.location.assign('/');
    });
  }

  return (
    <div className="ob">
      <div className="ob-panel">
        <div className="ob-mark" aria-hidden="true" />
        <h1 className="ob-title">{t('consent_title')}</h1>
        <p className="ob-text">{t('consent_text')}</p>
        <Link href="/privacidad" target="_blank" rel="noopener" className="consent-policy-link">
          {t('consent_link')} →
        </Link>

        <label className="auth-consent consent-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="auth-consent-box"
          />
          <span className="auth-consent-text">{t('consent_checkbox')}</span>
        </label>

        {failed && (
          <div role="alert" className="auth-error">
            ⚠ {t('consent_failed')}
          </div>
        )}

        <button
          type="button"
          onClick={accept}
          disabled={!checked || isPending}
          className="entry-submit"
        >
          {isPending ? t('consent_accepting') : t('consent_accept')}
        </button>

        <button type="button" onClick={decline} disabled={isPending} className="ob-skip">
          {t('consent_decline')}
        </button>
        <p className="consent-note">
          {t('consent_decline_note')} {PRIVACY_CONTACT_EMAIL}.
        </p>
      </div>
    </div>
  );
}
