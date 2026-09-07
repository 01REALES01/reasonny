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

interface UpsertProfileInput {
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

// Not exported: ensureProfile below is the only caller, and it is the shape
// callers actually want - "make sure this authenticated user has a row".
async function upsertProfile(
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
 * Sets the name the app addresses the user by.
 *
 * `full_name` has existed on the table since B1 and nothing ever wrote to it,
 * so the dashboard was deriving a greeting from the email handle - a guess that
 * is wrong for every address that is not a person's name.
 *
 * userId is the first parameter and scopes the WHERE, like every other
 * repository function: this is the isolation barrier, not RLS.
 */
export async function updateProfileName(
  userId: UserId,
  fullName: string | null,
): Promise<ProfileRow | null> {
  const db = getDb();
  const [row] = await db
    .update(profiles)
    .set({ fullName })
    .where(eq(profiles.id, userId))
    .returning();

  return row ?? null;
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
