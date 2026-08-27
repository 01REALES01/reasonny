/**
 * API Key repository.
 *
 * Handles SHA-256 hashed API keys for external ingestion (Shortcut / webhooks).
 */
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

import type { ApiKeyId, UserId } from '@/core/types';
import { toApiKeyId, toUserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { apiKeys } from '@/infrastructure/db/schema';

export type ApiKeyRow = typeof apiKeys.$inferSelect;

export interface CreateApiKeyInput {
  readonly name: string;
  readonly keyHash: string;
  readonly keyPrefix: string;
  readonly expiresAt?: Date | null;
}

export async function listApiKeys(userId: UserId): Promise<ApiKeyRow[]> {
  const db = getDb();
  return db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt);
}

export async function createApiKey(
  userId: UserId,
  input: CreateApiKeyInput,
): Promise<ApiKeyRow> {
  const db = getDb();
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId,
      name: input.name,
      keyHash: input.keyHash,
      keyPrefix: input.keyPrefix,
      expiresAt: input.expiresAt,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create API key "${input.name}" for user ${userId}`);
  }
  return row;
}

/**
 * Authenticates an incoming API key hash and updates its `lastUsedAt` timestamp.
 *
 * WHY THIS QUERY DOES NOT REQUIRE userId
 * ---------------------------------------
 * An API key header arrives with only the secret token. The hash lookup IS the
 * authentication step that verifies identity and securely retrieves the UserId.
 */
export async function verifyAndTouchApiKey(
  keyHash: string,
): Promise<{ userId: UserId; keyId: ApiKeyId } | null> {
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Touch lastUsedAt asynchronously
  await db
    .update(apiKeys)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(apiKeys.id, row.id));

  return {
    userId: toUserId(row.userId),
    keyId: toApiKeyId(row.id),
  };
}

export async function revokeApiKey(
  userId: UserId,
  keyId: ApiKeyId,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.id, keyId)))
    .returning();

  return Boolean(row);
}
