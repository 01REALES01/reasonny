import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthVideoBackdrop } from '@/components/auth/auth-video-backdrop';
import { getCurrentUser } from '@/lib/session';
import { SignInForm } from './sign-in-form';

// P8: Nothing behind or adjacent to authentication belongs in an index.
export const metadata: Metadata = {
  title: 'Reasonny — Razón y dinero, en el mismo lugar',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Asking for a code from someone who is already signed in is the single most
 * common way this app "logs you out": every call to action on the landing page
 * points here, so a signed-in user tapping any of them was handed the OTP form
 * and typed a new code for a session they already had.
 *
 * Reading the session makes this route dynamic, which is correct - a page whose
 * output depends on who is asking cannot be prerendered.
 */
export default async function SignInPage(): Promise<React.ReactElement> {
  if (await getCurrentUser()) {
    redirect('/dashboard');
  }

  return (
    <main className="auth-screen auth-screen--cinematic">
      <AuthVideoBackdrop />

      <div className="auth-layout">
        <div className="animate-entrance-2 auth-column">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
