import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';

import { resolveConnectionString } from './env';
import * as schema from './schema';

// neon-serverless talks over a WebSocket, which is what buys us transactions:
// neon-http sends each query as an independent POST, so there is no session to
// hold a BEGIN...COMMIT open. The OCR batch-create in phase 2 confirms ~40 rows
// as one unit, and a partial import after the user pressed "confirm" is exactly
// the failure that destroys trust in the data.
//
// Node 22+ ships a global WebSocket, so this costs no extra dependency.
neonConfig.webSocketConstructor ??= globalThis.WebSocket;

let instance: NeonDatabase<typeof schema> | undefined;

/**
 * Lazily built, then memoised.
 *
 * Lazy because a module-level connection would make `next build` require
 * credentials it has no business needing. Memoised because a serverless
 * instance is reused across invocations, and building a new pool per request
 * would pay the connection cost every time.
 */
export function getDb(): NeonDatabase<typeof schema> {
  if (!instance) {
    const pool = new Pool({
      connectionString: resolveConnectionString('runtime'),
      // Allow up to 20s for Neon serverless compute to wake from scale-to-zero suspension
      connectionTimeoutMillis: 20000,
    });
    // casing MUST match drizzle.config.ts, or generated queries reference
    // column names that do not exist in the migrated database.
    instance = drizzle(pool, { schema, casing: 'snake_case' });
  }
  return instance;
}
