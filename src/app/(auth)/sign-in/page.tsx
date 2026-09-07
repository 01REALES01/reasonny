import type { Metadata } from 'next';

import { AuthVideoBackdrop } from '@/components/auth/auth-video-backdrop';
import { SignInForm } from './sign-in-form';

// P8: Nothing behind or adjacent to authentication belongs in an index.
export const metadata: Metadata = {
  title: 'Reasonny — Razón y dinero, en el mismo lugar',
  robots: { index: false, follow: false },
};

export default function SignInPage(): React.ReactElement {
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
