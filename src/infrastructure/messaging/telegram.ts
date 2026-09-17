/**
 * The Telegram Bot API, as an adapter.
 *
 * Nothing above this file knows that Telegram exists in HTTP terms: it speaks
 * chats, messages and buttons, and this translates. When WhatsApp arrives it
 * gets a sibling here and core/services keeps its code (CLAUDE.md, the
 * messaging layer).
 *
 * WHY NO SDK
 * ----------
 * Every call is one POST of JSON to api.telegram.org and one JSON envelope
 * back. A library would add a dependency, a release cadence and its own
 * opinions about retries, in exchange for wrapping fetch. Node 22 has fetch.
 *
 * WHY NOTHING HERE THROWS ON A TELEGRAM ERROR
 * -------------------------------------------
 * This is called from a webhook that MUST answer 200 - Telegram retries
 * anything else, so an exception on the way out becomes the same message
 * arriving again and again. Failures come back as a value and the caller
 * decides. Only a missing bot token throws, because that is our misconfigured
 * server and not a runtime condition.
 */

const TOKEN_VAR = 'TELEGRAM_BOT_TOKEN';

function botToken(): string {
  const value = process.env[TOKEN_VAR];
  // Refusing beats defaulting, as with INGEST_TOKEN_SECRET: a placeholder
  // token would turn every send into a silent 401 from Telegram.
  if (!value) {
    throw new Error(
      `${TOKEN_VAR} must be set. Create a bot with @BotFather and paste the token it returns.`,
    );
  }
  return value;
}

/** The bot's public @name, used to build the t.me link the PWA shows. */
export function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME ?? null;
}

// ── The slice of the Bot API's types this app actually uses ─────────────────
//
// Hand-written and minimal on purpose. Telegram's Update has ~30 optional
// fields; declaring the four we read keeps the handler honest about what it
// supports instead of pattern-matching on a type that claims to cover
// everything.

export interface TelegramUser {
  readonly id: number;
  readonly is_bot: boolean;
  readonly first_name?: string;
  readonly username?: string;
  /** IETF tag from the user's Telegram settings: 'es', 'en-GB', … */
  readonly language_code?: string;
}

export interface TelegramChat {
  readonly id: number;
  readonly type: string;
}

export interface TelegramMessage {
  readonly message_id: number;
  readonly chat: TelegramChat;
  readonly from?: TelegramUser;
  readonly text?: string;
  readonly date: number;
}

export interface TelegramCallbackQuery {
  readonly id: string;
  readonly from: TelegramUser;
  readonly data?: string;
  readonly message?: TelegramMessage;
}

export interface TelegramUpdate {
  readonly update_id: number;
  readonly message?: TelegramMessage;
  readonly edited_message?: TelegramMessage;
  readonly callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  readonly text: string;
  /** 1-64 bytes of UTF-8. Telegram rejects the message otherwise. */
  readonly callback_data: string;
}

export interface InlineKeyboardMarkup {
  readonly inline_keyboard: readonly (readonly InlineKeyboardButton[])[];
}

// ── Calling it ──────────────────────────────────────────────────────────────

export type TelegramResult<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly error: string };

/**
 * How long a call may take before the caller gives up on it.
 *
 * A webhook handler runs inside somebody's request. Waiting on api.telegram.org
 * without a bound means a slow upstream holds a Vercel function open until the
 * platform kills it, and the user sees nothing either way.
 */
const DEFAULT_TIMEOUT_MS = 8_000;

async function call<T>(
  method: string,
  payload: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TelegramResult<T>> {
  let response: Response;

  try {
    response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // Network, DNS or the timeout above. The bot token must never reach a log
    // line, and it is in the URL, so the cause is reported without it.
    const reason = cause instanceof Error ? cause.message : 'network error';
    console.error(`[telegram] ${method} failed:`, reason);
    return { ok: false, error: reason };
  }

  let body: { ok?: boolean; result?: T; description?: string };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, error: `${method} returned a non-JSON body (${response.status})` };
  }

  if (!body.ok) {
    // Telegram's own refusal: a blocked bot, a chat that no longer exists, a
    // malformed keyboard. Worth the log line - these are the failures that are
    // otherwise invisible from the phone.
    const description = body.description ?? `HTTP ${response.status}`;
    console.warn(`[telegram] ${method} refused:`, description);
    return { ok: false, error: description };
  }

  return { ok: true, result: body.result as T };
}

export interface SendMessageOptions {
  readonly replyMarkup?: InlineKeyboardMarkup;
  /** Telegram's own Markdown dialect. Off by default: a merchant name is user text. */
  readonly parseMode?: 'MarkdownV2' | 'HTML';
}

export async function sendMessage(
  chatId: bigint | number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramResult<TelegramMessage>> {
  return call<TelegramMessage>('sendMessage', {
    chat_id: String(chatId),
    text,
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
  });
}

/**
 * Stops the spinner on a tapped button.
 *
 * Mandatory and FIRST, before any database work (PROJECT_SPEC §3.6). Telegram
 * leaves the button spinning until this arrives - the documentation allows up
 * to a minute - and a cold Neon start is seconds. The ack is deliberately
 * neutral: it says "received", never "saved", because the write has not
 * happened yet. What actually happened is told by editing the message.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<TelegramResult<boolean>> {
  return call<boolean>('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function editMessageText(
  chatId: bigint | number,
  messageId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramResult<TelegramMessage | boolean>> {
  return call<TelegramMessage | boolean>('editMessageText', {
    chat_id: String(chatId),
    message_id: messageId,
    text,
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
  });
}

export async function editMessageReplyMarkup(
  chatId: bigint | number,
  messageId: number,
  replyMarkup: InlineKeyboardMarkup | null,
): Promise<TelegramResult<TelegramMessage | boolean>> {
  return call<TelegramMessage | boolean>('editMessageReplyMarkup', {
    chat_id: String(chatId),
    message_id: messageId,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// ── Delivery mode ───────────────────────────────────────────────────────────
//
// Webhook and getUpdates are MUTUALLY EXCLUSIVE. While a webhook is registered
// Telegram refuses getUpdates with 409, which is why the dev script deletes it
// first and says so.

/**
 * Telegram's alphabet for secret_token: A-Z, a-z, 0-9, underscore, hyphen.
 *
 * `openssl rand -base64 32` produces none of the first three reliably and DOES
 * produce '=' padding, so the obvious way to generate a secret makes a value
 * Telegram refuses - with "Bad Request: secret token contains illegal
 * characters", at the moment the webhook is registered, which is long after
 * anyone would connect it to how the value was created. Use `-hex`.
 */
const SECRET_TOKEN_ALPHABET = /^[A-Za-z0-9_-]{1,256}$/;

export async function setWebhook(
  url: string,
  secretToken: string,
): Promise<TelegramResult<boolean>> {
  // Checked here rather than left to Telegram, so the message names the fix.
  if (!SECRET_TOKEN_ALPHABET.test(secretToken)) {
    return {
      ok: false,
      error:
        'TELEGRAM_WEBHOOK_SECRET may only contain A-Z a-z 0-9 _ - and be at most 256 characters. ' +
        'Base64 output (with its "=" padding) is rejected by Telegram. Generate one with: openssl rand -hex 32',
    };
  }

  return call<boolean>('setWebhook', {
    url,
    secret_token: secretToken,
    // Nothing else is read, and asking for less means Telegram stops sending
    // updates this app would only discard.
    allowed_updates: ['message', 'callback_query'],
    // Updates queued while the webhook was pointing at an older deployment are
    // not worth replaying into new code.
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(): Promise<TelegramResult<boolean>> {
  return call<boolean>('deleteWebhook', { drop_pending_updates: false });
}

export interface WebhookInfo {
  readonly url: string;
  readonly pending_update_count: number;
  readonly last_error_message?: string;
  readonly last_error_date?: number;
}

export async function getWebhookInfo(): Promise<TelegramResult<WebhookInfo>> {
  return call<WebhookInfo>('getWebhookInfo', {});
}

/**
 * Long polling, for local development only.
 *
 * `timeout` is Telegram's, not ours: the connection is held open that long
 * waiting for something to happen, so the local timeout has to be larger or
 * every poll would abort on its own.
 */
export async function getUpdates(
  offset: number,
  timeoutSeconds = 25,
): Promise<TelegramResult<TelegramUpdate[]>> {
  return call<TelegramUpdate[]>(
    'getUpdates',
    { offset, timeout: timeoutSeconds, allowed_updates: ['message', 'callback_query'] },
    (timeoutSeconds + 10) * 1000,
  );
}
