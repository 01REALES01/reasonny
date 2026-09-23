import { formatMoney, money } from '@/core/money';
import type { CategoryPrompt, MessagingAdapter } from '@/core/services/notification.service';
import { sendMessage } from '@/infrastructure/messaging/telegram';
import { intlTag, t, type Locale } from '@/lib/i18n';

import { suggestedKeyboard } from './keyboards';

/**
 * Telegram, as something core/services can ask to deliver a question.
 *
 * The whole point of the MessagingAdapter seam is that this file is the only
 * one that knows a question is a chat message with buttons under it. Swapping
 * in WhatsApp means writing a sibling of this file - not touching
 * notification.service.ts, which stays a statement about people and spends.
 */

/**
 * Telegram ids are documented to fit in 52 bits, so JSON.parse holds them
 * exactly - but the column is BIGINT and an id that somehow did not fit would
 * silently key the prompt to the wrong message, which is worse than no prompt.
 * Checked, not assumed - the same guard the update handler applies to chat ids.
 */
function toMessageId(id: number): bigint | null {
  return Number.isSafeInteger(id) ? BigInt(id) : null;
}

/**
 * What the message says above the buttons.
 *
 * Amount and merchant, nothing else. The user is looking at a banner on a lock
 * screen and has to recognise the spend in the half second before deciding
 * whether to answer now - a date they already know and an account they only
 * have one of would both be noise.
 *
 * No parse_mode: a merchant name is user text and can contain any of
 * Telegram's Markdown metacharacters, which would either escape wrong or make
 * the whole send fail. Plain text cannot be malformed.
 */
export function promptText(prompt: CategoryPrompt, locale: Locale): string {
  const amount = formatMoney(
    money(prompt.transaction.amountMinor, prompt.currency),
    intlTag(locale),
  );
  const mark = prompt.transaction.type === 'income' ? '💰' : '💸';

  return `${mark} ${amount} · ${prompt.transaction.merchant}\n${t('bot_ask_category', locale)}`;
}

/**
 * Built per conversation rather than exported as a singleton, because the
 * language belongs to the chat and not to the bot.
 */
export function telegramAdapter(locale: Locale): MessagingAdapter {
  return {
    provider: 'telegram',

    async deliverCategoryPrompt(chatId, prompt) {
      const sent = await sendMessage(chatId, promptText(prompt, locale), {
        replyMarkup: suggestedKeyboard(prompt.suggested, locale),
      });

      // `ok: false` is a blocked bot, a deleted chat, a network timeout. None
      // of them is an exception here: the spend is already stored, and the
      // caller records that the question did not go out (rule 7).
      if (!sent.ok) {
        return null;
      }

      const messageId = toMessageId(sent.result.message_id);
      return messageId === null ? null : { messageId };
    },
  };
}
