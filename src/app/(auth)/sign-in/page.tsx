import type { Metadata } from 'next';

import { SignInForm } from './sign-in-form';

// P8: nothing behind or adjacent to authentication belongs in an index.
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function SignInPage(): React.ReactElement {
  return (
    <main>
      {/* Exactly one h1, and it names the page. */}
      <h1>Sign in</h1>
      <SignInForm />
    </main>
  );
}
