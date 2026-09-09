import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import Link from 'next/link';

import { CategoryIcon } from '@/components/ui/category-icon';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getAutomaticCaptureStatus } from '@/core/repositories/transaction.repository';
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

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);

  // Only to word the link below. The wizard itself moved to /captura.
  const capture = await getAutomaticCaptureStatus(userId);

  return (
    <main className="entry-page">
      <ProfileForm
        email={profile.email}
        initialName={profile.fullName ?? ''}
        baseCurrency={profile.baseCurrency}
        timezone={profile.timezone}
      />
      {/* The wizard is a page now, not a panel at the bottom of this form. The
          link stays here for the user who already set it up: the dashboard
          button disappears once capture is confirmed, so this becomes the way
          back in - to check it is still running, or to redo it on a new phone. */}
      <Link href="/captura" className="settings-link">
        <span className="settings-link-text">
          <span className="settings-link-title">Guardado automático</span>
          <span className="settings-link-sub">
            {capture.count > 0
              ? `Funcionando · ${capture.count} ${capture.count === 1 ? 'pago recibido' : 'pagos recibidos'}`
              : 'Sin configurar'}
          </span>
        </span>
        <CategoryIcon name="ChevronRight" size={18} />
      </Link>
    </main>
  );
}
