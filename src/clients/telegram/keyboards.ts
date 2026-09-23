import type { CategoryRow } from '@/core/repositories/category.repository';
import type { InlineKeyboardButton, InlineKeyboardMarkup } from '@/infrastructure/messaging/telegram';
import { t, type Locale } from '@/lib/i18n';

import { categoryLabel } from './category-emoji';

/**
 * The buttons under a spend, and how to read one back.
 *
 * WHAT FITS IN A BUTTON
 * ---------------------
 * `callback_data` is 1-64 BYTES of UTF-8 and Telegram rejects the whole
 * message - not just the button - when it is longer. That single constraint
 * shapes everything here:
 *
 *   'c:' + uuid  =  2 + 36  =  38 bytes.  One id fits; two do not.
 *
 * So the button carries the CATEGORY and the message carries the TRANSACTION,
 * resolved server-side from (provider, chat, message_id) through
 * notification_prompts. That is also what PROJECT_SPEC §3.5 requires: the row
 * being written is never taken from the client's word for it. Anyone can post
 * a callback with arbitrary data, and the worst they can do with this shape is
 * name a category id - which is then checked against their own ledger anyway.
 */

const CATEGORY_PREFIX = 'c:';

/** Reserved words in the same namespace. A uuid can never collide with them. */
export const MORE_DATA = 'c:more';
export const NEW_DATA = 'c:new';

export type CallbackAction =
  | { readonly kind: 'category'; readonly categoryId: string }
  | { readonly kind: 'more' }
  | { readonly kind: 'new' };

/**
 * Shape check only - not an ownership check.
 *
 * Whether this user may file anything under this category is decided in
 * core/services, against the database. This just refuses the obviously
 * malformed so a bad payload never reaches a query.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCallbackData(data: string | undefined): CallbackAction | null {
  if (!data) {
    return null;
  }
  if (data === MORE_DATA) {
    return { kind: 'more' };
  }
  if (data === NEW_DATA) {
    return { kind: 'new' };
  }
  if (!data.startsWith(CATEGORY_PREFIX)) {
    return null;
  }
  const categoryId = data.slice(CATEGORY_PREFIX.length);
  return UUID.test(categoryId) ? { kind: 'category', categoryId } : null;
}

/**
 * Two per row.
 *
 * One per row makes a fifteen-category list a scroll; three per row makes each
 * button too narrow for its name on a phone. Two is what the PWA's picker
 * settled on for the same reason.
 */
const PER_ROW = 2;

function chunk(buttons: readonly InlineKeyboardButton[]): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += PER_ROW) {
    rows.push(buttons.slice(i, i + PER_ROW));
  }
  return rows;
}

function toButton(category: CategoryRow): InlineKeyboardButton {
  return {
    text: categoryLabel(category.name, category.icon),
    callback_data: `${CATEGORY_PREFIX}${category.id}`,
  };
}

/**
 * The keyboard sent with a new spend: a few choices, and a way to the rest.
 *
 * Three, not all of them. A user with fifteen categories gets a banner
 * notification on iOS that shows two rows before it clips, and the whole point
 * of level 2 is that it costs two gestures - a list you have to read first
 * costs more than opening the app. The three are the most used ones
 * (listMostUsedCategories), which is the same bet the rule engine makes: what
 * you did last is what you are about to do.
 */
export function suggestedKeyboard(
  categories: readonly CategoryRow[],
  locale: Locale,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ...chunk(categories.map(toButton)),
      [
        { text: t('bot_more_categories', locale), callback_data: MORE_DATA },
        { text: t('bot_new_category', locale), callback_data: NEW_DATA },
      ],
    ],
  };
}

/**
 * Every category of that direction, plus the escape hatch.
 *
 * No "back" button: the expanded grid is a superset of the three it replaced,
 * so there is nothing to go back TO - and a button that only undoes a previous
 * tap is one more thing to mis-hit.
 */
export function fullKeyboard(
  categories: readonly CategoryRow[],
  locale: Locale,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ...chunk(categories.map(toButton)),
      [{ text: t('bot_new_category', locale), callback_data: NEW_DATA }],
    ],
  };
}
