import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { TransactionMap } from '@/components/dashboard/transaction-map';
import { listCategories } from '@/core/repositories/category.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getEnrichedTransaction } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { EditTransactionForm } from './edit-transaction-form';

/** Any version, because the column accepts any version the database generated. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // The segment is whatever was typed in the address bar, and it goes into a
  // WHERE against a uuid column. Postgres does not reject a malformed uuid with
  // an empty result - it raises 22P02, which Next renders as a 500. A wrong id
  // is a page that is not there, so it has to be answered before the query.
  if (!UUID.test(id)) {
    notFound();
  }

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);

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
    <main className="entry-page entry-page--movimiento">
      <EditTransactionForm
        transaction={transaction}
        categories={categories}
        timeZone={profile.timezone}
      />

      {/* Only when there is a coordinate. Most spends have none - an SMS and a
          scanned statement never carry one - and an empty map frame saying
          "unknown" would be a permanent apology on most of these screens. */}
      {transaction.location && (
        <TransactionMap
          point={transaction.location}
          accuracyM={transaction.location.accuracyM}
          source={transaction.location.source}
          home={
            profile.homeLatitude !== null && profile.homeLongitude !== null
              ? {
                  latitude: Number(profile.homeLatitude),
                  longitude: Number(profile.homeLongitude),
                }
              : null
          }
        />
      )}
    </main>
  );
}
