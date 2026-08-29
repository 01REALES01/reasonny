/**
 * Migration runner that refuses to fail quietly.
 *
 * `drizzle-kit migrate` exited 1 without printing anything when Postgres
 * rejected an ALTER: the error was swallowed by its spinner. An exit code
 * nobody reads and no message on screen is how a half-migrated database
 * reaches production.
 *
 * So this wrapper does not trust drizzle-kit's word. It records which
 * migrations the database says it has applied, runs the tool, and reads the
 * ledger back. If the ledger did not move exactly as expected, it says which
 * migration is missing and exits non-zero.
 *
 * It also refuses to run a migration containing a type change with no USING
 * clause, which is the exact statement Postgres rejected.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { Pool, neonConfig } = await import('@neondatabase/serverless');
const { loadEnvFiles, resolveConnectionString } = await import(
  '../src/infrastructure/db/env'
);

loadEnvFiles();

neonConfig.webSocketConstructor ??= globalThis.WebSocket;

const MIGRATIONS_DIR = 'drizzle/migrations';

interface JournalEntry {
  readonly idx: number;
  readonly tag: string;
  readonly when: number;
}

const journal: { entries: JournalEntry[] } = JSON.parse(
  readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'),
);

/** Reads the ledger. A database with no migrations yet simply has no table. */
async function appliedTimestamps(pool: InstanceType<typeof Pool>): Promise<Set<number>> {
  try {
    const { rows } = await pool.query<{ created_at: string }>(
      'SELECT created_at FROM drizzle.__drizzle_migrations',
    );
    return new Set(rows.map((r) => Number(r.created_at)));
  } catch {
    return new Set();
  }
}

/**
 * Postgres will not cast text to uuid (and many other pairs) on its own, so a
 * bare SET DATA TYPE fails. drizzle-kit generates exactly that.
 */
function rejectUnsafeTypeChanges(tags: readonly string[]): void {
  const offenders: string[] = [];
  for (const tag of tags) {
    const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const line of sql.split('\n')) {
      if (/SET DATA TYPE/i.test(line) && !/USING/i.test(line)) {
        offenders.push(`${tag}: ${line.trim().slice(0, 100)}`);
      }
    }
  }
  if (offenders.length > 0) {
    console.error('\nRefusing to migrate: type change with no USING clause.\n');
    for (const o of offenders) console.error(`  ${o}`);
    console.error(
      '\nPostgres does not cast between most types implicitly. Add USING "col"::newtype.\n',
    );
    process.exit(1);
  }
}

const pool = new Pool({ connectionString: resolveConnectionString('migration') });

try {
  const before = await appliedTimestamps(pool);
  const pending = journal.entries.filter((e) => !before.has(e.when));

  if (pending.length === 0) {
    console.log('Nothing to apply: the database is up to date.');
    process.exit(0);
  }

  console.log(`Pending (${pending.length}):`);
  for (const e of pending) console.log(`  ${e.tag}`);

  rejectUnsafeTypeChanges(pending.map((e) => e.tag));

  let toolFailed = false;
  try {
    execFileSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], { stdio: 'inherit' });
  } catch {
    toolFailed = true;
  }

  // The check that matters. Read the ledger back rather than believing the tool.
  const after = await appliedTimestamps(pool);
  const stillPending = pending.filter((e) => !after.has(e.when));

  if (stillPending.length > 0) {
    console.error(`\nMIGRATION FAILED. ${stillPending.length} of ${pending.length} did not apply:`);
    for (const e of stillPending) console.error(`  ${e.tag}`);
    console.error(
      '\ndrizzle-kit can exit without printing the cause. Run the SQL by hand against a\n' +
        'throwaway Neon branch to see what Postgres actually says.\n',
    );
    process.exit(1);
  }

  if (toolFailed) {
    console.error('\ndrizzle-kit reported a failure, but every migration is recorded as applied.');
    console.error('Inspect the database before trusting this.\n');
    process.exit(1);
  }

  console.log(`\nApplied ${pending.length}. Ledger verified against the database.`);
} finally {
  await pool.end();
}
