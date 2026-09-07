import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ensureProfile } from '@/core/repositories/profile.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { ProfileForm } from './profile-form';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Perfil — Reasonny',
  robots: { index: false, follow: false },
};

export default async function ProfilePage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const profile = await ensureProfile(toUserId(session.id), session.email);

  return (
    <main className="entry-page">
      <ProfileForm
        email={profile.email}
        initialName={profile.fullName ?? ''}
        baseCurrency={profile.baseCurrency}
        timezone={profile.timezone}
      />
    </main>
  );
}
