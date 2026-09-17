import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { handleTelegramUpdate } from '@/clients/telegram/handle-update';
import type { TelegramUpdate } from '@/infrastructure/messaging/telegram';

/**
 * Telegram's webhook.
 *
 * A Route Handler and not a Server Action for the same reason quick-add is:
 * the caller is not a React form, it is Telegram's servers.
 *
 * Node runtime - the handler reaches the database through the services, and
 * neon-serverless opens a WebSocket the Edge runtime cannot.
 */
export const runtime = 'nodejs';

const SECRET_VAR = 'TELEGRAM_WEBHOOK_SECRET';

/**
 * The only thing standing between this URL and the open internet.
 *
 * The path is guessable and the endpoint writes to somebody's ledger, so
 * without this anyone could post fabricated spends into an account. Telegram
 * echoes the secret registered with setWebhook in this header on every
 * delivery.
 *
 * Compared in constant time: a byte-at-a-time comparison leaks the secret to
 * anyone patient enough to measure how long the rejection took.
 */
function isFromTelegram(request: NextRequest): boolean {
  const configured = process.env[SECRET_VAR];
  if (!configured) {
    return false;
  }

  const provided = request.headers.get('x-telegram-bot-api-secret-token');
  if (!provided) {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * WHY ALMOST EVERYTHING ANSWERS 200
 * ---------------------------------
 * Telegram redelivers any update the webhook did not answer 200 to, with
 * backoff, for a day. A 500 on one malformed message would turn into that same
 * message arriving over and over while the queue behind it stalls. So the
 * handler swallows its own failures (see handleTelegramUpdate) and this
 * answers 200 to anything that was genuinely from Telegram, whatever came of
 * it. 401 is the exception, and it is the one case where a retry is exactly
 * what should NOT be encouraged.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isFromTelegram(request)) {
    console.warn('[telegram] rejected a delivery with no valid secret header');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    // Authenticated but unreadable. Nothing to retry.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    // handleTelegramUpdate already swallows its own failures, so reaching here
    // means something went wrong in a place that was not supposed to be able
    // to - and a 500 would make Telegram redeliver this update all day. The
    // belt AND the braces, because the cost of the braces is four lines and
    // the cost of being wrong is a retry storm nobody is watching.
    console.error('[telegram] update', update.update_id, 'escaped the handler:', error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
