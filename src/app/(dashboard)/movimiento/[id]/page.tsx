import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { listCategories } from '@/core/repositories/category.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getEnrichedTransaction } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { EditTransactionForm } from './edit-transaction-form';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Movimiento — Reasonny',
  robots: { index: false, follow: false },
};

export default async function TransactionDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const { id } = await props.params;
  const userId = toUserId(session.id);
  await ensureProfile(userId, session.email);

  const [transaction, categories] = await Promise.all([
    getEnrichedTransaction(userId, id),
    listCategories(userId),
  ]);

  // 404, not 403: the repository scopes the read by userId, so a row belonging
  // to somebody else is indistinguishable from one that does not exist - and it
  // must stay that way, or the response confirms the id is real.
  if (!transaction) {
    notFound();
  }

  return (
    <main className="entry-page">
      <EditTransactionForm transaction={transaction} categories={categories} />
    </main>
  );
}
