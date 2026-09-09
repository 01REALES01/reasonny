import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { IngestSetup } from '@/components/ingest/ingest-setup';
import { CategoryIcon } from '@/components/ui/category-icon';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getAutomaticCaptureStatus } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { mintIngestToken } from '@/lib/ingest-token';
import { getCurrentUser } from '@/lib/session';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Guardado automático — Reasonny',
  robots: { index: false, follow: false },
};

/**
 * Setting up automatic capture, on a screen of its own.
 *
 * It used to be a panel at the bottom of /perfil, below the name field and the
 * currency - the least important form on the page carrying the most important
 * feature in the product. Nobody scrolls to the bottom of a settings page to
 * find the thing that makes the app work, and a nine-step walkthrough squeezed
 * under a "Guardar" button reads as an afterthought whatever the copy says.
 *
 * Its own route also gives it something a panel cannot have: an address. The
 * dashboard can send a new user straight here, and the link survives being
 * shared, bookmarked, or reopened weeks later on a different phone.
 */
export default async function CapturePage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);
  await ensureProfile(userId, session.email);
  const capture = await getAutomaticCaptureStatus(userId);

  // A missing secret must not take the page down: the explanation above the
  // wizard is worth reading even when the token cannot be minted, and the
  // wizard would only show a step the user cannot complete.
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
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>Inicio</span>
        </Link>
      </div>

      {ingest ? (
        <IngestSetup
          token={ingest.token}
          endpoint={ingest.endpoint}
          receivedCount={capture.count}
          lastReceivedAt={capture.lastAt?.toISOString() ?? null}
        />
      ) : (
        <section className="ingest">
          <h2 className="ingest-hook">Todavía no.</h2>
          <p className="ingest-lede">
            Falta configurar el servidor para poder emitir tu llave de acceso.
            Vuelve a intentarlo en un rato.
          </p>
        </section>
      )}
    </main>
  );
}
