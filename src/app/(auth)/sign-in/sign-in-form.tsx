'use client';

import React, { useState } from 'react';

import { getAuthClient } from '@/lib/auth-client';
import { t } from '@/lib/i18n';

type Step = 'intro' | 'email' | 'code';

export function SignInForm(): React.ReactElement {
  const [step, setStep] = useState<Step>('intro');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: React.FormEvent): Promise<void> {
    event.preventDefault();
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
