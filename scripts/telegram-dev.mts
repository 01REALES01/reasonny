/**
 * Runs the bot against your laptop, with no public URL and no tunnel.
 *
 * WHY THIS EXISTS
 * ---------------
 * A webhook means Telegram calls you, and Telegram cannot reach localhost. The
 * usual answer is ngrok - an account, a binary, a URL that changes every
 * restart. Telegram's other delivery mode makes all of that unnecessary:
 * getUpdates is an ordinary OUTBOUND request that asks "anything new?" and is
 * held open until there is. Nothing has to enter your machine.
 *
 * Both modes feed the same handleTelegramUpdate, so what you test here is what
 * production runs. The webhook route is only a second door.
 *
 *   pnpm telegram:dev
 *
 * THE ONE THING TO KNOW
 * ---------------------
 * The two modes are mutually exclusive. While a webhook is registered Telegram
 * answers getUpdates with 409, so this deletes it on start - and says so,
 * loudly, because forgetting to register it again means production goes quiet
 * with no error anywhere.
 */
process.loadEnvFile?.('.env.local');

const { deleteWebhook, getUpdates, setWebhook } = await import(
  '../src/infrastructure/messaging/telegram'
);
const { handleTelegramUpdate } = await import('../src/clients/telegram/handle-update');

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error(
    'TELEGRAM_BOT_TOKEN is not set.\n' +
      'Create the bot with @BotFather, then put the token it gives you in .env.local:\n' +
      '  TELEGRAM_BOT_TOKEN=8123456789:AAH...\n',
  );
  process.exit(1);
}

console.log('Switching to long polling for local development…');
const dropped = await deleteWebhook();
if (!dropped.ok) {
  console.error('Could not delete the webhook:', dropped.error);
  process.exit(1);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://reasonny.vercel.app';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

console.log(`
  Production is now receiving nothing - the two delivery modes are exclusive.
  It will be restored automatically when you stop this with Ctrl+C.
`);

if (!webhookSecret) {
  console.warn(
    '  ⚠  TELEGRAM_WEBHOOK_SECRET is not in .env.local, so production CANNOT be\n' +
      '     restored automatically. Run `pnpm telegram:webhook` yourself afterwards.\n',
  );
}

console.log('Listening. Write to the bot from your phone. Ctrl+C to stop.\n');

let running = true;

/**
 * Puts production back the way it was found.
 *
 * WHY THIS IS AUTOMATIC AND NOT A NOTE IN A README
 * ------------------------------------------------
 * Forgetting leaves the deployed bot silently deaf: no error, no log, no
 * failing request - Telegram simply has nowhere to deliver to, and the only
 * symptom is that nothing ever arrives. A failure with no signal is not
 * something to defend against with discipline. So the script that broke it is
 * the script that fixes it.
 */
async function restoreWebhook(): Promise<void> {
  if (!webhookSecret) {
    console.log('\nStopped. Production is still unhooked - run: pnpm telegram:webhook');
    return;
  }

  const url = `${appUrl}/api/v1/telegram`;
  const restored = await setWebhook(url, webhookSecret);

  console.log(
    restored.ok
      ? `\nStopped. Production restored: ${url}`
      : `\nStopped, but restoring the webhook FAILED: ${restored.error}\n` +
        '  Run `pnpm telegram:webhook` before you rely on the deployed bot.',
  );
}

/**
 * ONE Ctrl+C ARRIVES MORE THAN ONCE
 * ---------------------------------
 * The terminal sends SIGINT to the whole foreground process group - pnpm, tsx
 * and this process - and tsx forwards it to its child on top of that. So a
 * single press lands here two or three times within milliseconds, and a naive
 * "second signal means force quit" turned every ordinary Ctrl+C into "Forced.
 * Production is still unhooked", skipping the restore it exists to guarantee.
 *
 * A deliberate second press comes seconds later, while the restore is visibly
 * taking too long. That is the one that means "do not wait".
 */
const FORCE_QUIT_AFTER_MS = 2_000;
let shutdownStartedAt = 0;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    const now = Date.now();

    if (shutdownStartedAt) {
      if (now - shutdownStartedAt > FORCE_QUIT_AFTER_MS) {
        console.log('\nForced. Production is still unhooked - run: pnpm telegram:webhook');
        process.exit(1);
      }
      // An echo of the same press. Already shutting down.
      return;
    }

    shutdownStartedAt = now;
    running = false;
    console.log('\nRestoring the production webhook…');
    void restoreWebhook().then(() => process.exit(0));
  });
}

// Telegram's cursor. Acknowledging update N means "do not send me N or lower
// again", so it must only advance after the update has actually been handled -
// otherwise a crash loses the message instead of replaying it.
let offset = 0;

while (running) {
  const batch = await getUpdates(offset);

  if (!batch.ok) {
    console.error('Poll failed:', batch.error, '- retrying in 3s');
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    continue;
  }

  for (const update of batch.result) {
    const text = update.message?.text ?? update.callback_query?.data ?? '(no text)';
    console.log(`→ ${update.update_id}: ${text}`);
    await handleTelegramUpdate(update);
    offset = update.update_id + 1;
  }
}
