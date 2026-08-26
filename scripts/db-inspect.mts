// Read-only. Confirms what actually landed on main. No writes to production.
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool, neonConfig } = await import('@neondatabase/serverless');
const { resolveConnectionString } = await import('../src/infrastructure/db/env');
neonConfig.webSocketConstructor ??= globalThis.WebSocket;
const pool = new Pool({ connectionString: resolveConnectionString('runtime') });
try {
  const q = async <T extends Record<string, unknown>>(s: string) => (await pool.query<T>(s)).rows;
  const t = await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> '__drizzle_migrations' ORDER BY 1`);
  console.log(`tablas (${t.length}): ${t.map((r) => r.table_name).join(', ')}`);
  const tg = await q<{ tgname: string; tbl: string }>(
    `SELECT tgname, c.relname AS tbl FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid
     WHERE NOT g.tgisinternal ORDER BY 1`);
  console.log(`triggers (${tg.length}): ${tg.map((r) => `${r.tgname}@${r.tbl}`).join(', ')}`);
  const rls = await q<{ relname: string }>(
    `SELECT relname FROM pg_class WHERE relrowsecurity AND relnamespace='public'::regnamespace ORDER BY 1`);
  console.log(`RLS activado en (${rls.length}): ${rls.map((r) => r.relname).join(', ')}`);
  const pol = await q<{ polname: string }>(`SELECT polname FROM pg_policy`);
  console.log(`politicas RLS: ${pol.length} (esperado 0 hasta Fase 7)`);
  const camel = await q<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name <> lower(column_name)`);
  console.log(`columnas camelCase residuales: ${camel.length} (debe ser 0)`);
  const rows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM transactions`);
  console.log(`filas en transactions: ${rows[0]!.n} (main limpio)`);
} finally { await pool.end(); }
