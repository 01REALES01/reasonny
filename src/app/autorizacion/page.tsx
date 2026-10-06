import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import React from 'react';

import { POLICY_VERSION } from '@/core/privacy';
import { hasConsent } from '@/core/repositories/consent.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { ConsentForm } from './consent-form';

export const metadata: Metadata = {
  title: 'Autorización — Reasonny',
  robots: { index: false, follow: false },
};

/**
 * Where the gate in (dashboard)/layout sends anyone signed in without a
 * consent for the current policy: the three people who signed up before it
 * existed, and anyone who reaches the app without having ticked the box.
 *
 * Outside the (dashboard) group on purpose - inside it, the gate would send
 * this page to itself.
 */
export default async function AuthorizationPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }
  // Already accepted (another tab, the back button): nothing to ask.
  if (await hasConsent(toUserId(session.id), POLICY_VERSION)) {
    redirect('/dashboard');
  }

  return (
    <main className="entry-page entry-page--bienvenida">
      <ConsentForm />
    </main>
  );
}
