import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { listAccounts } from '@/core/repositories/account.repository';
import {
  listCategories,
  seedDefaultCategories,
} from '@/core/repositories/category.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { QuickAddForm } from './quick-add-form';

// P8: Authenticated screens carry noindex
export const metadata: Metadata = {
  title: 'Nuevo Registro — RealMoney',
  robots: { index: false, follow: false },
};

export default async function QuickAddPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);

  let [accounts, categories] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
  ]);

  // Seed default categories if first time
  if (categories.length === 0) {
    categories = await seedDefaultCategories(userId);
  }

  return (
    <main
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: 'var(--space-4)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <QuickAddForm accounts={accounts} categories={categories} />
    </main>
  );
}
