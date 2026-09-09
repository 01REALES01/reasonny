/**
 * The log of everything the ingestion endpoint could not store.
 *
 * The table has existed since B1 and nothing ever wrote to it, which is how a
 * transfer can be made, the SMS can arrive, the Shortcut can fire, and the app
 * can end up with nothing to say about any of it. A message the parser cannot
 * read is the single most valuable artefact this system produces - it is the
 * only thing that names the template a bank changed - and it was being dropped
 * on the floor.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { ingestionFailures } from '@/infrastructure/db/schema';

export type IngestionFailureRow = typeof ingestionFailures.$inferSelect;

export interface RecordIngestionFailureInput {
  /** Which capture channel produced it: 'sms_shortcut', 'telegram_text'... */
  readonly source: string;
  /**
   * Exactly what arrived. Stored verbatim on purpose - a normalised copy
   * cannot answer "which character did the parser trip on".
   */
  readonly rawPayload: unknown;
  /** Machine-readable reason, matching the parser's own vocabulary. */
  readonly error: string;
}

/**
 * userId is nullable here and only here: a request whose bearer token does not
 * verify has no user to attribute the failure to, and losing the evidence
 * because of that is exactly backwards - an unattributable failure is the one
 * most worth seeing.
 */
export async function recordIngestionFailure(
  userId: UserId | null,
  input: RecordIngestionFailureInput,
): Promise<void> {
  const db = getDb();
  await db.insert(ingestionFailures).values({
    userId,
    source: input.source,
    rawPayload: input.rawPayload as object,
    error: input.error,
  });
}

/** The unresolved ones, newest first. What a diagnostics screen would read. */
export async function listOpenIngestionFailures(
  userId: UserId,
  limit = 20,
): Promise<IngestionFailureRow[]> {
  const db = getDb();
  return db
    .select()
    .from(ingestionFailures)
    .where(
      and(
        eq(ingestionFailures.userId, userId),
        isNull(ingestionFailures.resolvedAt),
      ),
    )
    .orderBy(desc(ingestionFailures.createdAt))
    .limit(limit);
}
