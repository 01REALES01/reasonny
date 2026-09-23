import { formatMoney, money } from '@/core/money';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import { captureFromText } from '@/core/services/chat-capture.service';
import {
  answerCategoryPrompt,
  createCategoryForPrompt,
  listPromptChoices,
  notifyIfUncategorized,
  resolvePromptContext,
  trackFollowUpPrompt,
  type PromptContext,
} from '@/core/services/notification.service';
import { linkChatWithToken, resolveChat } from '@/core/services/telegram-link.service';
import { toUserId, type UserId } from '@/core/types';
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  editMessageText,
  sendMessage,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
  type TelegramUser,
} from '@/infrastructure/messaging/telegram';
import { DEFAULT_LOCALE, intlTag, t, type Locale } from '@/lib/i18n';

import { categoryLabel } from './category-emoji';
import { fullKeyboard, parseCallbackData } from './keyboards';
import { telegramAdapter } from './messaging-adapter';

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

/** The only provider this client speaks for. */
const PROVIDER = 'telegram' as const;

/** Every row this client writes is filed as typed-in-a-chat. */
const SOURCE = 'telegram_text' as const;

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
 * wrong chat or the wrong message, and both columns are BIGINT. Checked rather
 * than assumed.
 */
function toBigId(id: number): bigint | null {
  return Number.isSafeInteger(id) ? BigInt(id) : null;
}

/** `/start`, `/start <token>`, `/start@thebot <token>`. */
function parseStart(text: string): { isStart: boolean; payload: string | null } {
  const match = /^\/start(?:@\S+)?(?:\s+(\S+))?\s*$/.exec(text.trim());
  return match ? { isStart: true, payload: match[1] ?? null } : { isStart: false, payload: null };
}

// ── What a saved spend reads like ───────────────────────────────────────────

function amountText(amountMinor: bigint, currency: string, locale: Locale): string {
  return formatMoney(money(amountMinor, currency), intlTag(locale));
}

/**
 * The line the user sees once a spend is filed.
 *
 * With the category when there is one, because that line is the entire proof
 * that the rule engine exists: the second time you write `juan valdez` the bot
 * answers with the category already on it and never asks again. Without a
 * category it is just a receipt - and in that case a keyboard is on its way in
 * the next message anyway.
 */
function savedLine(
  amountMinor: bigint,
  currency: string,
  merchant: string,
  category: { readonly name: string; readonly icon: string } | null,
  locale: Locale,
): string {
  const head = `✅ ${t('bot_saved', locale)} · ${amountText(amountMinor, currency, locale)} · ${merchant}`;
  return category ? `${head}\n${categoryLabel(category.name, category.icon)}` : head;
}

// ── Messages ────────────────────────────────────────────────────────────────

/**
 * A reply to one of the bot's own questions names a new category.
 *
 * Returns false when the replied-to message is not a prompt of ours, so the
 * text falls through and is read as a spend instead. Somebody quoting an old
 * message while writing `12000 tienda` should still get a transaction.
 */
async function handleCategoryNameReply(
  userId: UserId,
  chatId: bigint,
  repliedToMessageId: number,
  name: string,
  locale: Locale,
): Promise<boolean> {
  const messageId = toBigId(repliedToMessageId);
  if (messageId === null) {
    return false;
  }

  const context = await resolvePromptContext(userId, PROVIDER, chatId, messageId);

  // Not every prompt is a question about a NAME. The keyboard message is a
  // prompt too, and replying to it - which is what people do when they answer
  // the bot in a hurry - would otherwise create a category called
  // "12000 juan valdez" and record no spend at all.
  if (!context || context.kind !== 'category_name') {
    return false;
  }

  const result = await createCategoryForPrompt(userId, context, name);

  if (!result.ok) {
    // 'duplicate' is not an error the user caused twice: the category exists,
    // and the original message still has its buttons, so the way out is to
    // tap it. Saying so beats inventing a second path to the same place.
    const key =
      result.reason === 'duplicate'
        ? 'bot_new_category_duplicate'
        : result.reason === 'invalid'
          ? 'bot_new_category_invalid'
          : 'bot_save_failed';
    await sendMessage(chatId, t(key, locale));
    return true;
  }

  await sendMessage(
    chatId,
    savedLine(
      result.transaction.amountMinor,
      result.transaction.currency,
      result.transaction.merchant,
      { name: result.category.name, icon: result.category.icon },
      locale,
    ),
  );
  return true;
}

/**
 * A line of text becomes a spend, and then a question if it needs one.
 *
 * The order is rule 7 made literal: the transaction is stored first and the
 * keyboard goes out second. If the send fails - blocked bot, dead network -
 * the money is already recorded and /revisar has it.
 */
async function captureSpend(
  userId: UserId,
  profile: ProfileRow,
  chatId: bigint,
  messageId: number,
  text: string,
  locale: Locale,
): Promise<void> {
  const result = await captureFromText(userId, profile, text, {
    source: SOURCE,
    // The message id, not a hash of the words: two coffees at the same place
    // for the same amount is two spends, and a redelivered update is one.
    externalId: `${PROVIDER}:${chatId}:${messageId}`,
  });

  if (!result.ok) {
    const key =
      result.reason === 'no_amount'
        ? 'bot_parse_no_amount'
        : result.reason === 'no_merchant'
          ? 'bot_parse_no_merchant'
          : result.reason === 'not_positive'
            ? 'bot_parse_not_positive'
            : 'bot_capture_failed';
    await sendMessage(chatId, t(key, locale));
    return;
  }

  if (result.isDuplicate) {
    await sendMessage(chatId, t('bot_saved_duplicate', locale));
    return;
  }

  // Level 1: the engine knew. One message, no buttons, nothing to tap - which
  // is the entire point of the thing.
  if (result.appliedCategory) {
    await sendMessage(
      chatId,
      savedLine(
        result.transaction.amountMinor,
        result.transaction.currency,
        result.transaction.merchant,
        result.appliedCategory,
        locale,
      ),
    );
    return;
  }

  // Level 2: the question doubles as the receipt. A separate "saved" message
  // above it would be two notifications for one coffee.
  const prompted = await notifyIfUncategorized(
    userId,
    profile,
    result.transaction,
    telegramAdapter(locale),
  );
  if (prompted.sent) {
    return;
  }

  // The question did not go out. The money IS stored, so the fallback says so
  // rather than leaving the user wondering - and names the fixable case.
  const hint =
    prompted.reason === 'no_categories' ? `\n\n${t('bot_no_categories', locale)}` : '';

  await sendMessage(
    chatId,
    `${savedLine(
      result.transaction.amountMinor,
      result.transaction.currency,
      result.transaction.merchant,
      null,
      locale,
    )}${hint}`,
  );
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  // Private chats only. A group has a different id space and a shared audience,
  // and nothing about a personal ledger belongs in one.
  if (message.chat.type !== 'private') {
    return;
  }

  const chatId = toBigId(message.chat.id);
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
  const userId = toUserId(profile.id);

  // A reply is only a category name when it is not a command. Otherwise
  // answering the "type a name" question with /ayuda would create a category
  // called "/ayuda", and the user would have to go to the app to delete it.
  const repliedTo = text.startsWith('/') ? undefined : message.reply_to_message?.message_id;
  if (repliedTo !== undefined) {
    const handled = await handleCategoryNameReply(userId, chatId, repliedTo, text, locale);
    if (handled) {
      return;
    }
  }

  if (text.startsWith('/')) {
    const isHelp = /^\/(help|ayuda)(?:@\S+)?$/.test(text);
    await sendMessage(chatId, t(isHelp ? 'bot_help' : 'bot_unknown_command', locale));
    return;
  }

  await captureSpend(userId, profile, chatId, message.message_id, text, locale);
}

// ── Buttons ─────────────────────────────────────────────────────────────────

/**
 * A tapped category button.
 *
 * PROJECT_SPEC §3.6 fixes the order and it is not negotiable:
 *
 *   1. answerCallbackQuery, with no text. Telegram spins the button until this
 *      arrives, and a cold Neon start is seconds - so the ack cannot wait for
 *      the write. It says "received", never "saved", because at this point
 *      nothing has been.
 *   2. The write.
 *   3. editMessageText with what ACTUALLY happened, the failure included.
 *
 * The message is edited rather than answered with a new one: the question
 * becomes its own answer, so the chat does not fill with a receipt for every
 * coffee.
 */
async function applyCategory(
  userId: UserId,
  chatId: bigint,
  messageId: number,
  context: PromptContext,
  categoryId: string,
  locale: Locale,
): Promise<void> {
  const result = await answerCategoryPrompt(userId, context, categoryId);

  if (!result.ok) {
    await editMessageText(chatId, messageId, t('bot_save_failed', locale));
    return;
  }

  const line = savedLine(
    result.transaction.amountMinor,
    result.transaction.currency,
    result.transaction.merchant,
    { name: result.category.name, icon: result.category.icon },
    locale,
  );

  // The promise that the next one is free. Only when a rule was actually
  // written - a generic merchant like "Transferencia enviada" teaches nothing
  // (core/categorization.ts), and claiming otherwise would be a lie the user
  // would catch the very next time.
  const suffix = result.learned ? `\n${t('bot_learned', locale)}` : '';

  // No reply_markup: omitting it on an edit is what removes the keyboard, so
  // the answered question cannot be answered twice by accident.
  await editMessageText(chatId, messageId, `${line}${suffix}`);
}

/** `Otras…` - swap the three suggestions for the whole list, in place. */
async function expandCategories(
  userId: UserId,
  chatId: bigint,
  messageId: number,
  context: PromptContext,
  locale: Locale,
): Promise<void> {
  const categories = await listPromptChoices(userId, context);

  if (categories.length === 0) {
    await editMessageText(chatId, messageId, t('bot_no_categories', locale));
    return;
  }

  // Only the keyboard changes. Rewriting the text would redraw the amount and
  // merchant the user is still reading.
  await editMessageReplyMarkup(chatId, messageId, fullKeyboard(categories, locale));
}

/**
 * `➕ Nueva` - ask for a name with force_reply.
 *
 * The original message keeps its buttons on purpose. If the user changes their
 * mind halfway through naming a category, tapping an existing one still works;
 * closing the door behind them would leave a message that asks a question with
 * no way to answer it.
 */
async function askForNewCategory(
  userId: UserId,
  chatId: bigint,
  context: PromptContext,
  locale: Locale,
): Promise<void> {
  const sent = await sendMessage(chatId, t('bot_new_category_ask', locale), {
    replyMarkup: { force_reply: true },
  });

  if (!sent.ok) {
    return;
  }

  const askedMessageId = toBigId(sent.result.message_id);
  if (askedMessageId === null) {
    return;
  }

  // The reply will quote THIS message, so it needs its own row pointing at the
  // same transaction - that is the only thread back from "Mercado" to a spend.
  await trackFollowUpPrompt(
    userId,
    PROVIDER,
    chatId,
    askedMessageId,
    context.transaction.id,
  );
}

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const locale = localeFor(query.from);

  // FIRST, before anything that can block. See applyCategory's docblock.
  await answerCallbackQuery(query.id);

  const message = query.message;
  if (!message || message.chat.type !== 'private') {
    return;
  }

  const chatId = toBigId(message.chat.id);
  const messageId = toBigId(message.message_id);
  const action = parseCallbackData(query.data);
  if (chatId === null || messageId === null || !action) {
    return;
  }

  const profile = await resolveChat(chatId);
  if (!profile) {
    await editMessageText(chatId, message.message_id, t('bot_not_linked', locale));
    return;
  }
  const userId = toUserId(profile.id);

  const context = await resolvePromptContext(userId, PROVIDER, chatId, messageId);
  if (!context) {
    // A SEPARATE message, never an edit of this one.
    //
    // Editing without reply_markup removes the keyboard, and one of the ways
    // to reach this branch is a race, not a deletion: the prompt row is
    // INSERTed after sendMessage returns, so a tap on the banner during a Neon
    // cold start can arrive before the row commits. Stripping the buttons
    // there would make the spend permanently uncategorisable from the chat
    // over a few hundred milliseconds of timing. Leaving them means the
    // second tap works.
    await sendMessage(chatId, t('bot_prompt_expired', locale));
    return;
  }

  if (context.transaction.category) {
    // Answered already - a redelivered callback, or a second tap. Saying so
    // beats silently overwriting a category the user chose a moment ago.
    await editMessageText(
      chatId,
      message.message_id,
      `${savedLine(
        context.transaction.amountMinor,
        context.transaction.currency,
        context.transaction.merchant,
        context.transaction.category,
        locale,
      )}`,
    );
    return;
  }

  switch (action.kind) {
    case 'category':
      await applyCategory(userId, chatId, message.message_id, context, action.categoryId, locale);
      return;
    case 'more':
      await expandCategories(userId, chatId, message.message_id, context, locale);
      return;
    case 'new':
      await askForNewCategory(userId, chatId, context, locale);
      return;
  }
}

/**
 * An edit is not a correction, and pretending otherwise loses money.
 *
 * The idempotency key is `telegram:<chat>:<message>`, so editing `1200 juan
 * valdez` into `12000` produces the SAME key: the insert hits ON CONFLICT DO
 * NOTHING, the bot answers "ya lo tenía registrado", and the wrong amount
 * stays in the ledger with the user believing they fixed it. Silence would be
 * just as bad. So the edit is refused out loud.
 *
 * Editing to make an edit work would mean matching on the message id and
 * UPDATEing a stored transaction from a chat - a write path with no
 * confirmation step, on a surface where a fat finger is the normal case.
 * /movimiento/[id] is where a spend is corrected.
 */
async function refuseEdit(message: TelegramMessage): Promise<void> {
  if (message.chat.type !== 'private') {
    return;
  }
  const chatId = toBigId(message.chat.id);
  if (chatId === null) {
    return;
  }
  await sendMessage(chatId, t('bot_edit_ignored', localeFor(message.from)));
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message) {
      await handleMessage(update.message);
      return;
    }

    if (update.edited_message) {
      await refuseEdit(update.edited_message);
      return;
    }

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (error) {
    // One malformed update must not stop the next one, and must not become a
    // non-200 that makes Telegram redeliver it forever.
    console.error('[telegram] update', update.update_id, 'failed:', error);
  }
}
