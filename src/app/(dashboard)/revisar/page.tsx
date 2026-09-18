import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { listCategories } from '@/core/repositories/category.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { listUncategorizedTransactions } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { ReviewQueue } from './review-queue';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Por revisar — Reasonny',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);

  const [transactions, categories] = await Promise.all([
    listUncategorizedTransactions(userId),
    listCategories(userId),
  ]);

  return (
    <main className="entry-page entry-page--revisar">
      <ReviewQueue
        transactions={transactions}
        categories={categories}
        timeZone={profile.timezone}
      />
    </main>
  );
}
