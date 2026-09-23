/**
 * Points Telegram at the deployed app.
 *
 * Run after every `pnpm telegram:dev` session, and whenever the production URL
 * changes. Registering a webhook is what stops long polling working, and vice
 * versa - the two are mutually exclusive, and neither one complains when the
 * other is active.
 *
 *   pnpm telegram:webhook           # register, then print what Telegram thinks
 *   pnpm telegram:webhook --status  # only print what Telegram thinks
 */
process.loadEnvFile?.('.env.local');

const { setWebhook, setMyCommands, getWebhookInfo } = await import(
  '../src/infrastructure/messaging/telegram'
);
const { DICTIONARY } = await import('../src/lib/i18n');

const statusOnly = process.argv.includes('--status');
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://reasonny.vercel.app';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set in .env.local.');
  process.exit(1);
}

if (!statusOnly) {
  if (!secret) {
    console.error(
      'TELEGRAM_WEBHOOK_SECRET is not set in .env.local.\n' +
        'It must be the SAME value as the one in Vercel, or Telegram will send a\n' +
        'header production rejects and every update will be dropped with a 401.',
    );
    process.exit(1);
  }

  const url = `${appUrl}/api/v1/telegram`;
  const registered = await setWebhook(url, secret);

  if (!registered.ok) {
    console.error('setWebhook failed:', registered.error);
    process.exit(1);
  }
  console.log(`Registered: ${url}`);

  // Registered here and not on every update: Telegram stores the list per bot,
  // and it is what makes the Menu button appear. Without it the commands work
  // but nobody discovers them, which is the same as not having them.
  //
  // Spanish is the default list; the English one is layered on top for phones
  // set to English. The command NAMES stay Spanish in both - they are the
  // bot's vocabulary, and renaming them per language would mean a user who
  // switches their phone's language loses the commands they had learned.
  const commands = (locale: 'es' | 'en') => [
    { command: 'saldo', description: DICTIONARY[locale].bot_cmd_balance_desc },
    { command: 'hoy', description: DICTIONARY[locale].bot_cmd_today_desc },
    { command: 'mes', description: DICTIONARY[locale].bot_cmd_month_desc },
    { command: 'ayuda', description: DICTIONARY[locale].bot_cmd_help_desc },
  ];

  const defaults = await setMyCommands(commands('es'));
  const english = await setMyCommands(commands('en'), 'en');

  // Not fatal: the webhook is already registered and the bot works. What is
  // lost is discovery, so each failure is reported rather than swallowed.
  if (!defaults.ok) console.error('setMyCommands (es) failed:', defaults.error);
  if (!english.ok) console.error('setMyCommands (en) failed:', english.error);
  if (defaults.ok && english.ok) {
    console.log('Commands registered: /saldo /hoy /mes /ayuda  (es + en)');
  }
}

const info = await getWebhookInfo();
if (!info.ok) {
  console.error('getWebhookInfo failed:', info.error);
  process.exit(1);
}

console.log('\nWhat Telegram thinks right now:');
console.log('  url:                  ', info.result.url || '(none - long polling is active)');
console.log('  pending updates:      ', info.result.pending_update_count);
if (info.result.last_error_message) {
  // The single most useful line when the bot has gone quiet: Telegram records
  // why its last delivery attempt failed, and nothing else surfaces it.
  console.log('  last delivery error:  ', info.result.last_error_message);
  console.log(
    '  when:                 ',
    info.result.last_error_date
      ? new Date(info.result.last_error_date * 1000).toISOString()
      : '(unknown)',
  );
}
