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

const { setWebhook, getWebhookInfo } = await import('../src/infrastructure/messaging/telegram');

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
