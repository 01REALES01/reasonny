/**
 * Prints the phase-1 baselines in the exact shape METRICS.md expects (B9).
 *
 * Read-only. Exists so that filling in METRICS.md is a copy-paste rather than a
 * hand-written summary of a query somebody ran once - which is how a number
 * ends up in a document with no method next to it, in direct violation of P6.
 *
 * Usage:
 *   pnpm metrics:report                 # the only profile, if there is one
 *   pnpm metrics:report jean@mail.com   # a specific profile by email
 *   pnpm metrics:report --since 2026-08-01
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool, neonConfig } = await import('@neondatabase/serverless');
const { resolveConnectionString } = await import('../src/infrastructure/db/env');
const { getPhase1Baselines } = await import('../src/core/services/telemetry.service');
const { toUserId } = await import('../src/core/types');

neonConfig.webSocketConstructor ??= globalThis.WebSocket;

const args = process.argv.slice(2);
const sinceFlagIndex = args.indexOf('--since');
const sinceRaw = sinceFlagIndex >= 0 ? args[sinceFlagIndex + 1] : undefined;
const email = args.find((a) => a.includes('@'));

let since: Date | undefined;
if (sinceRaw) {
  since = new Date(sinceRaw);
  if (Number.isNaN(since.getTime())) {
    console.error(`--since is not a date: "${sinceRaw}"`);
    process.exit(1);
  }
}

// Resolving which profile to report on is the one thing that needs raw SQL:
// there is no repository for "list every tenant", by design, because no
// application code is ever allowed to ask that question.
const pool = new Pool({ connectionString: resolveConnectionString('runtime') });

try {
  const { rows } = await pool.query<{ id: string; email: string; timezone: string }>(
    email
      ? `SELECT id, email, timezone FROM profiles WHERE email = $1`
      : `SELECT id, email, timezone FROM profiles ORDER BY created_at LIMIT 2`,
    email ? [email] : [],
  );

  if (rows.length === 0) {
    console.error(email ? `No profile with email ${email}.` : 'No profiles yet.');
    process.exit(1);
  }
  if (!email && rows.length > 1) {
    console.error('More than one profile exists. Pass an email to choose one.');
    process.exit(1);
  }

  const profile = rows[0]!;
  const baselines = await getPhase1Baselines(
    toUserId(profile.id),
    profile.timezone,
    since,
  );

  const fmt = (value: number | null, unit: 'ms' | 'ratio'): string => {
    if (value === null) return '—';
    return unit === 'ratio' ? value.toFixed(3) : `${Math.round(value)} ms`;
  };

  // P6: n and method travel with every figure, or the figure is decoration.
  const line = (s: { metric: string; n: number; unit: 'ms' | 'ratio'; p50: number | null; p75: number | null; p95: number | null }) =>
    `  ${s.metric.padEnd(26)} p50 ${fmt(s.p50, s.unit).padStart(9)}` +
    `  p75 ${fmt(s.p75, s.unit).padStart(9)}` +
    `  p95 ${fmt(s.p95, s.unit).padStart(9)}   n=${s.n}`;

  console.log(`\nRealMoney - phase 1 baselines`);
  console.log(`profile   ${profile.email}`);
  console.log(`timezone  ${baselines.timezone}`);
  console.log(`window    ${since ? `since ${since.toISOString()}` : 'all time'}`);
  console.log(`generated ${baselines.generatedAt.toISOString()}\n`);

  console.log('Durations');
  console.log(line(baselines.manualEntryDuration));
  console.log(line(baselines.dashboardQueryDuration));

  console.log('\nCore Web Vitals (P7 is defined on p75)');
  for (const vital of baselines.webVitals) {
    const verdict =
      vital.budget === null || vital.budget.meets === null
        ? 'no reading'
        : vital.budget.meets
          ? `within budget (<= ${vital.budget.target})`
          : `OVER BUDGET (> ${vital.budget.target})`;
    console.log(`${line(vital)}   ${verdict}`);
  }

  const { daysWithEntry, daysElapsed, rate } = baselines.dailyUsage;
  console.log('\nDaily usage (retention baseline)');
  console.log(
    `  ${daysWithEntry}/${daysElapsed} days with at least one entry` +
      `   rate=${(rate * 100).toFixed(1)}%`,
  );

  if (baselines.manualEntryDuration.n === 0) {
    console.log(
      '\nNo manual-entry samples yet. This is THE baseline phases 2 and 4 are ' +
        'measured against, and it can only be captured while entry is still manual.',
    );
  }
  console.log('');
} finally {
  await pool.end();
}
