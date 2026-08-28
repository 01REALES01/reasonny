/**
 * Profile repository.
 *
 * All operations enforce isolation using UserId as the primary partition key.
 */
import { eq } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { profiles } from '@/infrastructure/db/schema';

export type ProfileRow = typeof profiles.$inferSelect;

export interface UpsertProfileInput {
  readonly email: string;
  readonly fullName?: string | null;
  readonly baseCurrency?: string;
  readonly timezone?: string;
}

export async function getProfile(userId: UserId): Promise<ProfileRow | null> {
  const db = getDb();
  const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertProfile(
  userId: UserId,
  input: UpsertProfileInput,
): Promise<ProfileRow> {
  const db = getDb();
  const [row] = await db
    .insert(profiles)
    .values({
      id: userId,
      email: input.email,
      fullName: input.fullName,
      baseCurrency: input.baseCurrency ?? 'COP',
      timezone: input.timezone ?? 'America/Bogota',
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: input.email,
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.baseCurrency ? { baseCurrency: input.baseCurrency } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
      },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to upsert profile for user ${userId}`);
  }
  return row;
}

/**
 * Ensures a profile row exists in the profiles table for this authenticated user.
 * Neon Auth manages credentials in `neon_auth.user`; this ensures our domain
 * profile row and FK targets exist.
 */
export async function ensureProfile(
  userId: UserId,
  email: string,
): Promise<ProfileRow> {
  const existing = await getProfile(userId);
  if (existing) {
    return existing;
  }
  return upsertProfile(userId, { email });
}

export async function updateTelegramChatId(
  userId: UserId,
  telegramChatId: bigint | null,
): Promise<ProfileRow | null> {
  const db = getDb();
  const [row] = await db
    .update(profiles)
    .set({ telegramChatId })
    .where(eq(profiles.id, userId))
    .returning();
  return row ?? null;
}

/**
 * Resolves a profile by Telegram chat ID.
 *
 * WHY THIS QUERY DOES NOT TAKE userId
 * -----------------------------------
 * Telegram webhooks receive external updates identified ONLY by the sender's
 * Telegram chat ID. This lookup is the entry point that authenticates and
 * discovers which UserId owns that chat.
 */
export async function getProfileByTelegramChatId(chatId: bigint): Promise<ProfileRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.telegramChatId, chatId))
    .limit(1);
  return rows[0] ?? null;
}
