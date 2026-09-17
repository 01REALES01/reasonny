import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { listAccounts } from '@/core/repositories/account.repository';
import {
  listCategories,
  seedDefaultCategories,
} from '@/core/repositories/category.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { QuickAddForm } from './quick-add-form';

// P8: Authenticated screens carry noindex
export const metadata: Metadata = {
  title: 'Nuevo Registro — Reasonny',
  robots: { index: false, follow: false },
};

export default async function QuickAddPage(props: {
  searchParams: Promise<{ type?: string }>;
}): Promise<React.ReactElement> {
  const [session, searchParams] = await Promise.all([
    getCurrentUser(),
    props.searchParams,
  ]);

  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);
  // A link that already says which kind of movement this is ("Registrar
  // ingreso" on the dashboard) has answered step 0 before the screen opens.
  // Asking again is a tap the caller already spent.
  const requestedType =
    searchParams?.type === 'income'
      ? 'income'
      : searchParams?.type === 'expense'
        ? 'expense'
        : null;

  // Ensure profile row exists in database for foreign key integrity
  const profile = await ensureProfile(userId, session.email);

  let [accounts, categories] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
  ]);

  // Seed default categories if first time
  if (categories.length === 0) {
    categories = await seedDefaultCategories(userId);
  }

  return (
    <main className="entry-page entry-page--nuevo">
      <QuickAddForm
        accounts={accounts}
        categories={categories}
        initialType={requestedType ?? 'expense'}
        initialStep={requestedType ? 1 : 0}
        locationEnabled={profile.locationEnabled}
      />
    </main>
  );
}
