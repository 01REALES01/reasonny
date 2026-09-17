import { linkChatWithToken, resolveChat } from '@/core/services/telegram-link.service';
import {
  sendMessage,
  type TelegramMessage,
  type TelegramUpdate,
  type TelegramUser,
} from '@/infrastructure/messaging/telegram';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';

/**
 * The Telegram client. A translator, nothing else.
 *
 * It turns an Update into a call on core/services and the answer back into a
 * message. It holds no rule about money, no query, and deliberately no copy of
 * its own - every string comes from the catalogue, so the bot and the app say
 * the same things in the same two languages (P9, and the i18n rule from B5).
 *
 * tests/architecture.test.ts fails the build if anything under src/clients ever
 * imports the database.
 *
 * WHY IT NEVER THROWS
 * -------------------
 * Both callers need it not to. The webhook must answer 200 or Telegram redelivers
 * the same update forever; the dev poller must not die on one bad message.
 */

/**
 * Which language to answer in.
 *
 * Read from the user's Telegram settings rather than stored on the profile.
 * There is no locale column and adding one would ask the user to configure the
 * same preference twice - the phone already knows, and it is the phone they
 * are holding.
 */
export function localeFor(from: TelegramUser | undefined): Locale {
  return from?.language_code?.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

/**
 * Telegram ids are documented to fit in 52 bits, so JSON.parse does not lose
 * precision on them - but a value that somehow did would silently address the
 * wrong chat, and the column is BIGINT. Checked rather than assumed.
 */
function toChatId(id: number): bigint | null {
  return Number.isSafeInteger(id) ? BigInt(id) : null;
}

/** `/start`, `/start <token>`, `/start@thebot <token>`. */
function parseStart(text: string): { isStart: boolean; payload: string | null } {
  const match = /^\/start(?:@\S+)?(?:\s+(\S+))?\s*$/.exec(text.trim());
  return match ? { isStart: true, payload: match[1] ?? null } : { isStart: false, payload: null };
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  // Private chats only. A group has a different id space and a shared audience,
  // and nothing about a personal ledger belongs in one.
  if (message.chat.type !== 'private') {
    return;
  }

  const chatId = toChatId(message.chat.id);
  const text = message.text?.trim();
  if (chatId === null || !text) {
    return;
  }

  const locale = localeFor(message.from);
  const { isStart, payload } = parseStart(text);

  if (isStart) {
    if (!payload) {
      // Someone opened the bot from search instead of from the app's link.
      await sendMessage(chatId, t('bot_not_linked', locale));
      return;
    }

    const result = await linkChatWithToken(chatId, payload);

    if (!result.ok) {
      const key =
        result.reason === 'expired'
          ? 'bot_link_expired'
          : result.reason === 'no_profile'
            ? 'bot_link_no_profile'
            : 'bot_link_invalid';
      await sendMessage(chatId, t(key, locale));
      return;
    }

    await sendMessage(
      chatId,
      result.alreadyLinked
        ? t('bot_already_linked', locale)
        : `${t('bot_linked_title', locale)}\n\n${t('bot_linked_body', locale)}`,
    );
    return;
  }

  // Everything below needs to know whose ledger this is.
  const profile = await resolveChat(chatId);
  if (!profile) {
    await sendMessage(chatId, t('bot_not_linked', locale));
    return;
  }

  // Recording a spend from free text and the category keyboard land here next.
  await sendMessage(chatId, t('bot_unknown_command', locale));
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  try {
    const message = update.message ?? update.edited_message;
    if (message) {
      await handleMessage(message);
    }
    // callback_query is answered once there are buttons to tap.
  } catch (error) {
    // One malformed update must not stop the next one, and must not become a
    // non-200 that makes Telegram redeliver it forever.
    console.error('[telegram] update', update.update_id, 'failed:', error);
  }
}
