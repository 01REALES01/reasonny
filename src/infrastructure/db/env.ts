/**
 * Neon exposes two endpoints for the same database, and they are not
 * interchangeable. Picking the wrong one fails in ways that are easy to
 * misread, so the choice is resolved here once instead of at each call site.
 *
 * - Pooled (host contains "-pooler"): PgBouncer in transaction mode. This is
 *   what the app uses at runtime, because a serverless function may be cloned
 *   into many instances and each one would otherwise hold its own connection.
 *
 * - Direct (no "-pooler"): a plain session to Postgres. Migrations need this.
 *   drizzle-kit takes advisory locks and issues DDL, both of which are tied to
 *   a session; through a transaction pooler each statement may land on a
 *   different backend, so the lock silently protects nothing.
 */

type ConnectionKind = 'runtime' | 'migration';

type Env = Record<string, string | undefined>;

/**
 * Loads .env.local, then .env, for the tools that run outside Next.
 *
 * process.loadEnvFile is Node's own since 20.12, so this replaces the dotenv
 * dependency that four scripts and drizzle.config.ts each imported separately.
 *
 * Order matters and matches what dotenv did: loadEnvFile does not overwrite a
 * variable that is already set, so .env.local wins over .env - which is where
 * `neon init` writes by default. A missing file throws rather than returning a
 * flag, and that is not an error here: having only one of the two is the normal
 * case, and having neither is caught downstream by resolveConnectionString with
 * a message that names the variable.
 */
export function loadEnvFiles(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Absent file. See above.
    }
  }
}

const VARIABLE_BY_KIND = {
  runtime: 'DATABASE_URL',
  migration: 'DATABASE_URL_UNPOOLED',
} as const satisfies Record<ConnectionKind, string>;

const POOLER_MARKER = '-pooler';

function isPooled(connectionString: string, variableName: string): boolean {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error(
      `${variableName} is not a valid connection URL. Expected something like ` +
        `postgresql://user:password@host/dbname?sslmode=require`,
    );
  }
  return host.includes(POOLER_MARKER);
}

/**
 * Returns the connection string for the given use, or throws an error that
 * says what to fix. Throwing beats falling back: a migration that quietly runs
 * through the pooler is the failure this function exists to prevent.
 */
export function resolveConnectionString(kind: ConnectionKind, env: Env = process.env): string {
  const variableName = VARIABLE_BY_KIND[kind];
  const value = env[variableName]?.trim();

  if (!value) {
    throw new Error(
      `${variableName} is not set. Copy it from the Neon dashboard into .env.local ` +
        `(or run "npx neon@latest init"). See .env.example.`,
    );
  }

  const pooled = isPooled(value, variableName);

  if (kind === 'migration' && pooled) {
    throw new Error(
      `${variableName} points at the pooled endpoint (host contains "${POOLER_MARKER}"), ` +
        `but migrations need the direct one. Use the connection string whose host has no ` +
        `"${POOLER_MARKER}", otherwise drizzle-kit's advisory lock guards nothing.`,
    );
  }

  if (kind === 'runtime' && !pooled) {
    throw new Error(
      `${variableName} points at the direct endpoint, but the app should use the pooled one ` +
        `(host contains "${POOLER_MARKER}"). The direct endpoint opens one connection per ` +
        `function instance and runs out under concurrency.`,
    );
  }

  return value;
}
