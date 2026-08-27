/**
 * Achievement repository.
 *
 * Implements Principle P1: rewards consistency and behavior, never amounts or outcomes.
 */
import { desc, eq } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { achievements } from '@/infrastructure/db/schema';

export type AchievementRow = typeof achievements.$inferSelect;

export async function listAchievements(userId: UserId): Promise<AchievementRow[]> {
  const db = getDb();
  return db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId))
    .orderBy(desc(achievements.earnedAt));
}

/**
 * Grants an achievement if not already earned for the given period.
 *
 * Safe against concurrent attempts due to `uq_achievement` constraint.
 */
export async function grantAchievement(
  userId: UserId,
  code: string,
  periodKey?: string | null,
): Promise<{ achievement: AchievementRow | null; newlyEarned: boolean }> {
  const db = getDb();
  const [row] = await db
    .insert(achievements)
    .values({
      userId,
      code,
      periodKey: periodKey ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return {
    achievement: row ?? null,
    newlyEarned: Boolean(row),
  };
}
