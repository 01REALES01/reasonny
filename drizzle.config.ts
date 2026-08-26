import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

import { resolveConnectionString } from './src/infrastructure/db/env';

// drizzle-kit runs outside Next, so nothing has loaded the env files yet.
// .env.local first: dotenv does not overwrite what is already set, so a value
// there wins over .env (where `neon init` writes by default).
//
// These run before defineConfig() is called, and resolveConnectionString reads
// process.env at call time, so a static import is enough - and drizzle-kit
// transpiles this config to CJS, where a top-level await would not compile.
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle/migrations',
  // camelCase keys in TS map to snake_case columns in Postgres. Without this
  // Drizzle uses the JS key verbatim, producing a quoted "updatedAt" column
  // that the set_updated_at() trigger cannot find. MUST match the client.
  casing: 'snake_case',
  dbCredentials: { url: resolveConnectionString('migration') },
  // Ask before running anything destructive. In a money app a silently applied
  // DROP COLUMN is unrecoverable history, not an inconvenience.
  strict: true,
  verbose: true,
});
