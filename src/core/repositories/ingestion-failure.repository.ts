/**
 * Ingestion Failure repository.
 *
 * Records raw payloads and error details when webhook/ingestion parsing fails,
 * preventing silent data loss and supporting replay.
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import type { IngestionFailureId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { ingestionFailures } from '@/infrastructure/db/schema';

export type IngestionFailureRow = typeof ingestionFailures.$inferSelect;

export interface RecordIngestionFailureInput {
  readonly userId?: UserId | null;
  readonly source: string;
  readonly rawPayload: unknown;
  readonly error: string;
}

export async function recordIngestionFailure(
  input: RecordIngestionFailureInput,
): Promise<IngestionFailureRow> {
  const db = getDb();
  const [row] = await db
    .insert(ingestionFailures)
    .values({
      userId: input.userId ?? null,
      source: input.source,
      rawPayload: input.rawPayload,
      error: input.error,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to record ingestion failure');
  }
  return row;
}

export async function listIngestionFailures(
  userId: UserId,
): Promise<IngestionFailureRow[]> {
  const db = getDb();
  return db
    .select()
    .from(ingestionFailures)
    .where(eq(ingestionFailures.userId, userId))
    .orderBy(desc(ingestionFailures.createdAt));
}

export async function resolveIngestionFailure(
  userId: UserId,
  failureId: IngestionFailureId,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .update(ingestionFailures)
    .set({ resolvedAt: sql`now()` })
    .where(
      and(
        eq(ingestionFailures.userId, userId),
        eq(ingestionFailures.id, failureId),
      ),
    )
    .returning();

  return Boolean(row);
}
