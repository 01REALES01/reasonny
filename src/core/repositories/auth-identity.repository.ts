/**
 * The one place this app writes into Neon Auth's own tables.
 *
 * Only as a fallback for account deletion. The supported way to remove a
 * sign-in identity is Better Auth's delete-user endpoint; if Neon's managed
 * configuration has it switched off, the person who asked to be deleted would
 * keep an identity - their email - that nothing in the app can reach. The
 * schema note in infrastructure/db/schema.ts explains why there is no FK into
 * `neon_auth`; deleting a row from it is a narrower coupling than a FK, and
 * the right to deletion is worth it.
 */
import { sql } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';

export async function deleteAuthIdentity(userId: UserId): Promise<void> {
  const db = getDb();
  // Sessions and linked accounts reference the user with ON DELETE CASCADE in
  // Better Auth's schema, so they go with it.
  await db.execute(sql`DELETE FROM neon_auth."user" WHERE id = ${userId}`);
}
