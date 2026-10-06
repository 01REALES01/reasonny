/**
 * The proof of authorisation that Ley 1581 asks the controller to keep.
 */
import { and, eq } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { consents } from '@/infrastructure/db/schema';

export type ConsentMethod = 'sign_in' | 'gate';

export async function hasConsent(userId: UserId, policyVersion: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.policyVersion, policyVersion)))
    .limit(1);
  return row !== undefined;
}

/**
 * Idempotent by constraint (rule 6): two tabs accepting at once, or the gate
 * and the sign-in intent landing together, leave one row - the first, whose
 * timestamp is the moment that actually counts.
 */
export async function recordConsent(
  userId: UserId,
  policyVersion: string,
  method: ConsentMethod,
): Promise<void> {
  const db = getDb();
  await db.insert(consents).values({ userId, policyVersion, method }).onConflictDoNothing();
}
