'use client';

import Link from 'next/link';
import React, { useState } from 'react';

import {
  CONSENT_INTENT_COOKIE,
  CONSENT_INTENT_MAX_AGE_SECONDS,
  POLICY_VERSION,
} from '@/core/privacy';
import { getAuthClient } from '@/lib/auth-client';
import { t } from '@/lib/i18n';

/**
 * Leaves the ticked box where the first authenticated page can find it.
 * Authentication finishes on Neon's side (and, with Google, on Google's), so
 * there is no request of ours in between to carry it - see
 * CONSENT_INTENT_COOKIE for why this is a convenience and the row is the proof.
 */
function rememberConsentIntent(): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_INTENT_COOKIE}=${POLICY_VERSION}; Max-Age=${CONSENT_INTENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

type Step = 'intro' | 'email' | 'code';

export function SignInForm(): React.ReactElement {
  const [step, setStep] = useState<Step>('intro');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  // Ley 1581 wants the authorisation BEFORE the data, and the email is the
  // first datum: the box sits on the step that asks for it, and neither way in
  // (code or Google) proceeds without it.
  const [consented, setConsented] = useState(false);

  async function sendCode(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!consented) {
      setError(t('auth_consent_required'));
      return;
    }
    rememberConsentIntent();
    setBusy(true);
    setError(undefined);
    try {
      const auth = getAuthClient();
      const result = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (result.error) throw new Error(result.error.message ?? t('auth_send_failed'));
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth_send_failed'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const auth = getAuthClient();
      const result = await auth.signIn.emailOtp({ email, otp: code });
      if (result.error) throw new Error(result.error.message ?? t('auth_code_invalid'));
      window.location.assign('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth_code_invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle(): Promise<void> {
    if (!consented) {
      setError(t('auth_consent_required'));
      return;
    }
    rememberConsentIntent();
    setBusy(true);
    setError(undefined);
    try {
      const auth = getAuthClient();
      // Navigates away on success; a returned error means it never left.
      const result = await auth.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
      if (result?.error) throw new Error(result.error.message ?? t('auth_google_failed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth_google_failed'));
      setBusy(false);
    }
  }

  // STEP 1: editorial intro. No form, no field - just the way in.
  if (step === 'intro') {
    return (
      <div key="step-intro" className="step-slide auth-step">
        <div className="auth-copy">
          <h1 className="auth-title auth-title--hero">
            {t('auth_hero_line_1')}
            <br />
            {t('auth_hero_line_2')}
          </h1>
          <p className="auth-subtitle auth-subtitle--hero">{t('auth_hero_subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => setStep('email')}
          className="pill-btn auth-pill auth-pill--ghost"
        >
          <span>{t('auth_enter')}</span>
          <span className="pill-arrow">→</span>
        </button>
      </div>
    );
  }

  /**
   * STEPS 2 and 3 are one render.
   *
   * They were two near-identical 55-line blocks differing in four strings, one
   * input and which handler ran on submit. Kept apart, a fix to the error
   * banner or the back button had to be made twice - and the code input had
   * already drifted to a different border token than the email input for no
   * reason anyone recorded.
   */
  const isCodeStep = step === 'code';

  return (
    <form
      key={isCodeStep ? 'step-code' : 'step-email'}
      className="step-slide auth-step"
      onSubmit={isCodeStep ? verifyCode : sendCode}
    >
      <div className="auth-copy">
        <h2 className="auth-title">
          {isCodeStep ? t('auth_code_title') : t('auth_email_title')}
        </h2>
        <p className="auth-subtitle">
          {isCodeStep ? (
            <>
              {t('auth_code_subtitle')} <strong>{email}</strong>
            </>
          ) : (
            t('auth_email_subtitle')
          )}
        </p>
      </div>

      <label htmlFor={isCodeStep ? 'code' : 'email'} className="sr-only">
        {isCodeStep ? t('field_code') : t('field_email')}
      </label>

      {isCodeStep ? (
        <input
          id="code"
          type="text"
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="••••••"
          value={code}
          required
          onChange={(e) => setCode(e.target.value.trim())}
          className="auth-field auth-field--code"
        />
      ) : (
        <input
          id="email"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder={t('auth_email_placeholder')}
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          className="auth-field"
        />
      )}

      {!isCodeStep && (
        <label className="auth-consent">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => {
              setConsented(e.target.checked);
              if (e.target.checked) setError(undefined);
            }}
            className="auth-consent-box"
          />
          <span className="auth-consent-text">
            {t('auth_consent_label')}{' '}
            {/* A new tab: following the link must not throw away the email
                already typed. */}
            <Link href="/privacidad" target="_blank" rel="noopener" className="auth-consent-link">
              {t('auth_consent_link')}
            </Link>
            .
          </span>
        </label>
      )}

      {error && (
        <div role="alert" className="auth-error">
          ⚠ {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="pill-btn auth-pill auth-pill--solid">
        <span>
          {isCodeStep
            ? busy
              ? t('auth_verifying')
              : t('auth_verify')
            : busy
              ? t('auth_sending')
              : t('auth_send_code')}
        </span>
        <span className="pill-arrow">→</span>
      </button>

      {!isCodeStep && (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span>{t('auth_or')}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={continueWithGoogle}
            className="pill-btn auth-pill auth-google"
          >
            {/* Google's own four-colour mark: recognised at a glance, which is
                the whole point of offering this way in. */}
            <svg className="auth-google-mark" width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
              <path className="auth-google-red" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path className="auth-google-blue" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path className="auth-google-yellow" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path className="auth-google-green" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{t('auth_google')}</span>
          </button>
        </>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setStep(isCodeStep ? 'email' : 'intro');
          setError(undefined);
        }}
        className="auth-back"
      >
        ← {isCodeStep ? t('auth_change_email') : t('back')}
      </button>
    </form>
  );
}
