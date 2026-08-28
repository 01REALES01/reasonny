'use client';

import React, { useState } from 'react';

import { getAuthClient } from '@/lib/auth-client';

type Step = 'email' | 'code';

/**
 * Two-step passwordless sign-in with email one-time code (OTP).
 *
 * Implements high-polish dark mode styles matching DESIGN_SYSTEM.md tokens.
 */
export function SignInForm(): React.ReactElement {
  const [step, setStep] = useState<Step>('email');
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

  if (step === 'email') {
    return (
      <form
        onSubmit={sendCode}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label
            htmlFor="email"
            style={{
              fontSize: 'var(--text-label)',
              color: 'var(--ink-secondary)',
              fontWeight: 500,
            }}
          >
            Correo electrónico
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
              fontSize: 'var(--text-body)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--surface-sunken)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--ink-primary)',
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(229, 72, 77, 0.14)',
              color: 'var(--critical)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            backgroundColor: 'var(--brand-500)',
            color: '#FFFFFF',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-2)',
            boxShadow: '0 4px 16px rgba(129, 114, 242, 0.3)',
            height: '46px',
          }}
        >
          {busy ? 'Enviando código…' : 'Continuar con correo'}
        </button>

        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
          Te enviaremos un código de un solo uso. Sin contraseñas.
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={verifyCode}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h2 style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--ink-primary)' }}>
          Verifica tu código
        </h2>
        <p style={{ fontSize: 'var(--text-label)', color: 'var(--ink-secondary)' }}>
          Enviamos un código a <strong>{email}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <label
          htmlFor="code"
          style={{
            fontSize: 'var(--text-label)',
            color: 'var(--ink-secondary)',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          Código de 6 dígitos
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
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '0.3em',
            textAlign: 'center',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--surface-sunken)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--ink-primary)',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(229, 72, 77, 0.14)',
            color: 'var(--critical)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        style={{
          backgroundColor: 'var(--brand-500)',
          color: '#FFFFFF',
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-2)',
          boxShadow: '0 4px 16px rgba(129, 114, 242, 0.3)',
          height: '46px',
        }}
      >
        {busy ? 'Verificando…' : 'Ingresar a RealMoney'}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep('email');
          setError(undefined);
        }}
        disabled={busy}
        style={{
          backgroundColor: 'transparent',
          color: 'var(--ink-secondary)',
          fontSize: 'var(--text-label)',
          fontWeight: 500,
          padding: 'var(--space-2)',
        }}
      >
        ← Usar un correo diferente
      </button>
    </form>
  );
}
