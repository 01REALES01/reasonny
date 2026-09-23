/**
 * A category, as one character a button can show.
 *
 * `categories.icon` holds a Lucide name - 'ShoppingCart', 'Utensils' - and
 * `categories.color` a hex. Neither can be drawn on a Telegram button: the
 * chat has no stylesheet and no icon font, only text. So the same category
 * that renders as an SVG in the PWA (components/ui/category-icon.tsx) renders
 * as an emoji here.
 *
 * WHY THIS LIVES IN THE CLIENT AND NOT IN core/
 * ---------------------------------------------
 * It is presentation for one surface. A WhatsApp client would want the same
 * emoji and a future native app would want the SVG, but neither fact belongs
 * to what a category IS - and putting it in core/ would mean the domain model
 * knows what a chat bubble looks like. The vocabulary it maps (the seed
 * catalogue in category.repository.ts and the picker in
 * create-category-drawer.tsx) is shared; the rendering is not.
 *
 * An unmapped name falls back to a neutral dot rather than throwing, because a
 * user can create a category with any icon the picker later adds, and a
 * missing glyph must never be the reason a spend cannot be categorised.
 */

/**
 * Single code points wherever possible.
 *
 * ZWJ sequences (❤️‍🩹) and skin-tone modifiers render inconsistently across
 * Telegram's Android, iOS and desktop clients - and a button that shows a
 * tofu box beside its label is worse than one with no icon at all.
 */
const EMOJI_BY_ICON: Readonly<Record<string, string>> = {
  // Seed catalogue - expenses
  ShoppingCart: '🛒',
  Utensils: '🍽',
  Car: '🚗',
  Home: '🏠',
  HeartPulse: '🩺',
  Tv: '📺',
  ShoppingBag: '🛍',
  CreditCard: '💳',
  GraduationCap: '🎓',
  MoreHorizontal: '📦',
  // Seed catalogue - income
  Briefcase: '💼',
  Laptop: '💻',
  TrendingUp: '📈',
  PlusCircle: '➕',
  // The rest of what create-category-drawer.tsx offers
  Tag: '🏷',
  Coffee: '☕',
  Fuel: '⛽',
  Dumbbell: '🏋',
  Music: '🎵',
  Plane: '✈',
  Gift: '🎁',
  Sparkles: '✨',
};

/** Neutral, and the same fallback the PWA's icon component uses. */
export const FALLBACK_EMOJI = '•';

export function emojiForIcon(icon: string | null | undefined): string {
  return (icon && EMOJI_BY_ICON[icon]) || FALLBACK_EMOJI;
}

/**
 * How much of a category name fits on a button.
 *
 * Telegram wraps long button text onto several lines and shrinks the row,
 * which on a phone turns a two-button row into something hard to hit
 * accurately - and a mis-tap here files a spend under the wrong category
 * silently. Names are user-chosen and capped at 50 characters upstream.
 */
const MAX_LABEL = 22;

export function categoryLabel(name: string, icon: string | null | undefined): string {
  const trimmed = name.trim();
  const text = trimmed.length > MAX_LABEL ? `${trimmed.slice(0, MAX_LABEL - 1)}…` : trimmed;
  return `${emojiForIcon(icon)} ${text}`;
}
