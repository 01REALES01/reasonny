'use client';

import { useState } from 'react';

import { getAuthClient } from '@/lib/auth-client';

type Step = 'email' | 'code';

/**
 * Two steps, because Neon Auth has no magic link: a one-time code arrives by
 * email and is exchanged for a session. Same passwordless property as a link,
 * and on a phone it is better - no app switch, and no corporate link scanner
 * consuming the link before the user does.
 *
 * Styling is deliberately absent. The design system lands with the UI blocks;
 * inventing values here would mean rewriting them.
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
      if (result.error) throw new Error(result.error.message ?? 'Could not send the code.');
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the code.');
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
      if (result.error) throw new Error(result.error.message ?? 'That code did not work.');
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          required
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send code'}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode}>
      <p>We sent a code to {email}.</p>
      <label htmlFor="code">Code</label>
      <input
        id="code"
        // One-time-code lets iOS and Android offer the code from the message
        // itself, which is most of why this beats a link on a phone.
        autoComplete="one-time-code"
        inputMode="numeric"
        value={code}
        required
        onChange={(e) => setCode(e.target.value)}
      />
      <button type="submit" disabled={busy}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" onClick={() => setStep('email')} disabled={busy}>
        Use a different email
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
