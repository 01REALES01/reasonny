import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ensureProfile } from '@/core/repositories/profile.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { OnboardingFlow } from './onboarding-flow';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Bienvenida — Reasonny',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const profile = await ensureProfile(toUserId(session.id), session.email);

  return (
    <main className="entry-page">
      <OnboardingFlow
        initialName={profile.fullName ?? ''}
        baseCurrency={profile.baseCurrency}
      />
    </main>
  );
}
