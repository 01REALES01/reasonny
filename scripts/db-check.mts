/**
 * Verifies the connection and reports the facts B1.b depends on.
 *
 * Also times the first query separately from the second: the gap is Neon's
 * cold start after auto-suspend, the number that drives the retry queue in the
 * Shortcut and the answerCallbackQuery-before-write ordering in the Telegram
 * handler. Worth seeing on your own instance rather than trusting the docs.
 */
const { Pool, neonConfig } = await import('@neondatabase/serverless');
const { loadEnvFiles, resolveConnectionString } = await import(
  '../src/infrastructure/db/env'
);

loadEnvFiles();

neonConfig.webSocketConstructor ??= globalThis.WebSocket;

const pool = new Pool({ connectionString: resolveConnectionString('runtime') });

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  const result = await run();
  console.log(`  ${label}: ${Math.round(performance.now() - startedAt)} ms`);
  return result;
}

try {
  console.log('\nConnection');
  const first = await timed('first query (includes cold start, if suspended)', () =>
    pool.query('SELECT 1 AS ok'),
  );
  await timed('second query (warm)', () => pool.query('SELECT 1 AS ok'));
  console.log(`  SELECT 1 returned: ${JSON.stringify(first.rows[0])}`);

  console.log('\nServer');
  const server = await pool.query<{
    version: string;
    database: string;
    server_version_num: string;
  }>(
    `SELECT version() AS version,
            current_database() AS database,
            current_setting('server_version_num') AS server_version_num`,
  );
  const row = server.rows[0]!;
  const majorVersion = Math.floor(Number(row.server_version_num) / 10_000);
  console.log(`  database: ${row.database}`);
  console.log(`  ${row.version.split(' on ')[0]}`);

  console.log('\nCapabilities the schema in B1.b depends on');
  // UNIQUE NULLS NOT DISTINCT (PG15+) is what lets `achievements` be repeatable
  // per period while one-off codes with a NULL period_key stay unique.
  console.log(`  PG >= 15  (UNIQUE NULLS NOT DISTINCT): ${majorVersion >= 15 ? 'yes' : 'NO'} [major ${majorVersion}]`);

  // PG18 ships uuidv7(). Time-ordered keys keep index inserts at the right edge
  // of the btree instead of scattering them. Whether to use it is a B1.b call.
  const uuidv7 = await pool.query<{ present: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuidv7') AS present`,
  );
  console.log(`  uuidv7() available: ${uuidv7.rows[0]?.present ? 'yes' : 'no'}`);

  const extensions = await pool.query<{ name: string }>(
    `SELECT name FROM pg_available_extensions WHERE name IN ('vector', 'pg_session_jwt') ORDER BY name`,
  );
  console.log(`  extensions available for later phases: ${extensions.rows.map((e) => e.name).join(', ') || 'none'}`);

  console.log('\nOK\n');
} finally {
  await pool.end();
}
