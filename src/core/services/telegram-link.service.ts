import {
  getProfile,
  getProfileByTelegramChatId,
  linkTelegramChat,
  unlinkTelegramChat,
  type ProfileRow,
} from '@/core/repositories/profile.repository';
import type { UserId } from '@/core/types';
import { mintLinkToken, verifyLinkToken } from '@/lib/telegram-link-token';

/**
 * Binding a Telegram chat to an account.
 *
 * WHY THIS ONE NAMES A PROVIDER AND THE NOTIFICATION LAYER WILL NOT
 * -----------------------------------------------------------------
 * Sending a message is abstractable: "tell this user their spend was saved"
 * means the same thing on Telegram and on WhatsApp, which is why
 * notification.service.ts will not know which one it is talking to. Binding is
 * not. A Telegram chat id is a Telegram fact, stored in a column that says so,
 * and inventing a provider parameter with exactly one legal value would be an
 * abstraction that documents a flexibility the schema does not have.
 *
 * The rule from CLAUDE.md still holds: the webhook handler and the PWA page
 * are clients. Neither of them decides what linking means. This does.
 */

export interface LinkInvite {
  /** Tap target: opens the chat and sends the token as the first message. */
  readonly url: string;
  /** The same thing typed by hand, for when the deep link does not carry. */
  readonly command: string;
  readonly botUsername: string;
}

/**
 * Everything the PWA needs to offer the link, or null when the bot is unnamed.
 *
 * WHY THE TYPED COMMAND EXISTS ALONGSIDE THE LINK
 * -----------------------------------------------
 * The deep link is the good path: tapping it opens the chat and sends
 * `/start <token>` on its own. But it does not always carry - Telegram Web
 * shows an interstitial when the browser is not signed in, and a link copied
 * between devices can lose its query string on the way. When that happens the
 * user lands in the right chat with no token, presses START, and gets told the
 * chat is not connected - with nothing on screen to do about it.
 *
 * One token, two ways to deliver it. The second costs a line of copy and
 * removes the dead end.
 */
export function buildLinkInvite(
  userId: UserId,
  botUsername: string | null,
): LinkInvite | null {
  if (!botUsername) {
    return null;
  }

  const token = mintLinkToken(userId);
  return {
    url: `https://t.me/${botUsername}?start=${token}`,
    command: `/start ${token}`,
    botUsername,
  };
}

export type LinkChatResult =
  | { readonly ok: true; readonly profile: ProfileRow; readonly alreadyLinked: boolean }
  | { readonly ok: false; readonly reason: 'expired' | 'invalid' | 'no_profile' };

/**
 * Turns a token pasted into a chat into a binding.
 *
 * `expired` is answered separately from `invalid` on purpose: expiry is the
 * failure a real user hits - they opened the screen, got distracted, came back
 * twenty minutes later - and "your link expired, open the screen again" is
 * actionable where "invalid" is not. A forged signature gets the vague answer,
 * because whoever sent it is not the person to help.
 */
export async function linkChatWithToken(
  chatId: bigint,
  token: string | null | undefined,
): Promise<LinkChatResult> {
  const verified = verifyLinkToken(token);

  if (!verified.ok) {
    return { ok: false, reason: verified.reason === 'expired' ? 'expired' : 'invalid' };
  }

  // The token proves who they are, but the row is created at sign-in and
  // ensureProfile would need an email this chat does not carry.
  const existing = await getProfile(verified.userId);
  if (!existing) {
    return { ok: false, reason: 'no_profile' };
  }

  const alreadyLinked = existing.telegramChatId === chatId;

  const profile = alreadyLinked ? existing : await linkTelegramChat(verified.userId, chatId);
  if (!profile) {
    return { ok: false, reason: 'no_profile' };
  }

  return { ok: true, profile, alreadyLinked };
}

/** The tenant behind an incoming chat, or null when it is not bound to one. */
export async function resolveChat(chatId: bigint): Promise<ProfileRow | null> {
  return getProfileByTelegramChatId(chatId);
}

export async function unlinkChat(userId: UserId): Promise<boolean> {
  const profile = await unlinkTelegramChat(userId);
  return profile !== null;
}
