'use client';

import React, { useState } from 'react';

import { t } from '@/lib/i18n';

import { getAuthClient } from '@/lib/auth-client';

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
      if (result.error) throw new Error(result.error.message ?? 'No se pudo enviar el código.');
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el código.');
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
      if (result.error) throw new Error(result.error.message ?? 'El código ingresado es incorrecto.');
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El código ingresado es incorrecto.');
    } finally {
      setBusy(false);
    }
  }

  // STEP 1: Hero Editorial Intro (1:1 Reference Aesthetic)
  if (step === 'intro') {
    return (
      <div
        key="step-intro"
        className="step-slide"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '48px',
              lineHeight: 1.04,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              margin: 0,
            }}
          >
            Bank Smarter.<br />Quickly. Globally.
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              lineHeight: 1.55,
              color: 'rgba(255, 255, 255, 0.52)',
              margin: 0,
              fontWeight: 400,
            }}
          >
            Disfruta de un control financiero inteligente y sin esfuerzo, estés donde estés, cuando lo necesites.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStep('email')}
          className="pill-btn"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 'var(--radius-full)',
            padding: '18px 24px',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all var(--duration-fast)',
            width: '100%',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.38)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
          }}
        >
          <span>Ingresar a RealMoney</span>
          <span className="pill-arrow" style={{ fontSize: '18px' }}>→</span>
        </button>
      </div>
    );
  }

  // STEP 2: Email input
  if (step === 'email') {
    return (
      <form
        key="step-email"
        className="step-slide"
        onSubmit={sendCode}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: '#FFFFFF',
              margin: 0,
            }}
          >
            Tu Correo
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.52)', margin: 0 }}>
            Te enviaremos un código seguro de un solo uso.
          </p>
        </div>

        <label htmlFor="email" className="sr-only">
          {t('field_email')}
        </label>
        <input
          id="email"
          type="email"
          placeholder="tu@correo.com"
          value={email}
          required
          autoFocus
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          style={{
            fontSize: '16px',
            padding: '16px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 'var(--radius-lg)',
            color: '#FFFFFF',
            
          }}
        />

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(229, 72, 77, 0.18)',
              color: '#FF6B6B',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="pill-btn"
          style={{
            backgroundColor: '#FFFFFF',
            color: '#000000',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '18px 24px',
            fontSize: '15px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span>{busy ? 'Enviando código…' : 'Enviar Código'}</span>
          <span className="pill-arrow" style={{ fontSize: '18px' }}>→</span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setStep('intro')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '4px',
            textAlign: 'center',
          }}
        >
          ← Volver
        </button>
      </form>
    );
  }

  // STEP 3: OTP 6-Digit Code
  return (
    <form
      key="step-otp"
      className="step-slide"
      onSubmit={verifyCode}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '36px',
            fontWeight: 400,
            color: '#FFFFFF',
            margin: 0,
          }}
        >
          Verifica tu Código
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.52)', margin: 0 }}>
          Ingresa el código enviado a <strong>{email}</strong>
        </p>
      </div>

      <label htmlFor="code" className="sr-only">
        {t('field_code')}
      </label>
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
        style={{
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.35em',
          textAlign: 'center',
          padding: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 'var(--radius-lg)',
          color: '#FFFFFF',
          fontFamily: 'monospace',
          
        }}
      />

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(229, 72, 77, 0.18)',
            color: '#FF6B6B',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
          }}
        >
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="pill-btn"
        style={{
          backgroundColor: '#FFFFFF',
          color: '#000000',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          padding: '18px 24px',
          fontSize: '15px',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          width: '100%',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>{busy ? 'Verificando…' : 'Acceder al Dashboard'}</span>
        <span className="pill-arrow" style={{ fontSize: '18px' }}>→</span>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setStep('email');
          setError(undefined);
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: '13px',
          cursor: 'pointer',
          padding: '4px',
          textAlign: 'center',
        }}
      >
        ← Cambiar de correo
      </button>
    </form>
  );
}
