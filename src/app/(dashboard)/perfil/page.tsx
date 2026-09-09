import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ensureProfile } from '@/core/repositories/profile.repository';
import { getAutomaticCaptureStatus } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { mintIngestToken } from '@/lib/ingest-token';
import { getCurrentUser } from '@/lib/session';

import { IngestSetup } from './ingest-setup';
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

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);

  // What the server has actually received, so the setup screen can stop taking
  // the user's word for it.
  const capture = await getAutomaticCaptureStatus(userId);

  // A missing secret must not take the whole profile page down with it - the
  // name form has nothing to do with ingestion.
  let ingest: { token: string; endpoint: string } | null = null;
  try {
    ingest = {
      token: mintIngestToken(userId),
      endpoint: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://reasonny.vercel.app'}/api/v1/quick-add`,
    };
  } catch {
    ingest = null;
  }

  return (
    <main className="entry-page">
      <ProfileForm
        email={profile.email}
        initialName={profile.fullName ?? ''}
        baseCurrency={profile.baseCurrency}
        timezone={profile.timezone}
      />
      {ingest && (
        <IngestSetup
          token={ingest.token}
          endpoint={ingest.endpoint}
          receivedCount={capture.count}
          lastReceivedAt={capture.lastAt?.toISOString() ?? null}
        />
      )}
    </main>
  );
}
