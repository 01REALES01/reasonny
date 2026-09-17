import { createHmac, timingSafeEqual } from 'node:crypto';

import { toUserId, type UserId } from '@/core/types';

/**
 * The token inside the `t.me/<bot>?start=<token>` link that binds a chat to an
 * account.
 *
 * WHY NOT REUSE mintIngestToken
 * -----------------------------
 * The ingest token deliberately never expires: it lives inside one Shortcut on
 * one phone, and rotating INGEST_TOKEN_SECRET is its whole revocation story.
 * This one is different in kind. It travels through a tap target, is visible
 * in a URL, and whoever opens that link starts writing transactions into the
 * account - so it has to stop working on its own, quickly.
 *
 * WHY IT SHARES THE SECRET ANYWAY
 * -------------------------------
 * A second environment variable is a second thing to set, forget, and get
 * wrong in one environment out of two. Instead the signed payload is prefixed
 * with a domain tag, so a link token can never be replayed as an ingest token
 * and vice versa: the two sign different strings even for the same user.
 */

const SECRET_VAR = 'INGEST_TOKEN_SECRET';

/** Domain separation. Without it the two token families share a signature space. */
const DOMAIN = 'tg-link';

/**
 * Long enough to walk from the browser to Telegram, short enough that a link
 * left in a screenshot, a chat history or a browser tab is dead by the time
 * anybody finds it.
 */
export const LINK_TOKEN_TTL_SECONDS = 15 * 60;

function secret(): string {
  const value = process.env[SECRET_VAR];
  if (!value || value.length < 32) {
    throw new Error(
      `${SECRET_VAR} must be set and at least 32 characters. Generate one with: openssl rand -base64 32`,
    );
  }
  return value;
}

function sign(userId: string, expiresAt: number): string {
  return createHmac('sha256', secret())
    .update(`${DOMAIN}:${userId}:${expiresAt}`)
    .digest('base64url');
}

/**
 * `<userId>.<unix expiry>.<signature>`.
 *
 * Base64url and dots because this ends up in a URL query string, where `+`
 * and `/` of plain base64 would need escaping and Telegram's own start
 * parameter accepts a limited alphabet.
 */
export function mintLinkToken(userId: UserId, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + LINK_TOKEN_TTL_SECONDS;
  return `${userId}.${expiresAt}.${sign(userId, expiresAt)}`;
}

export type LinkTokenFailure = 'malformed' | 'expired' | 'bad_signature';

export type LinkTokenResult =
  | { readonly ok: true; readonly userId: UserId }
  | { readonly ok: false; readonly reason: LinkTokenFailure };

/**
 * Never throws on malformed input - this reads straight off a chat message,
 * where anyone can type anything after `/start`.
 *
 * The signature is checked BEFORE the expiry. Answering "expired" for a token
 * that was never signed would tell an attacker their forgery had the right
 * shape, and the expiry is inside the signed payload precisely so it cannot be
 * edited to a later one.
 */
export function verifyLinkToken(
  token: string | null | undefined,
  now = Date.now(),
): LinkTokenResult {
  if (!token) {
    return { ok: false, reason: 'malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed' };
  }

  const [rawUserId, rawExpiry, provided] = parts as [string, string, string];

  // Strictly digits: Number(' 12') is 12 and Number('1e99') is a float, and
  // either would make the expiry comparison mean something other than it reads.
  if (!/^\d+$/.test(rawExpiry)) {
    return { ok: false, reason: 'malformed' };
  }
  const expiresAt = Number(rawExpiry);

  let expected: string;
  try {
    expected = sign(rawUserId, expiresAt);
  } catch {
    // Misconfigured server, not a bad token. The caller turns this into a 500.
    throw new Error(`${SECRET_VAR} is not configured`);
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // Length first: timingSafeEqual throws on a mismatch, and the comparison
  // itself is constant-time so the signature cannot be learned one byte at a
  // time from how long the request took.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  if (Math.floor(now / 1000) >= expiresAt) {
    return { ok: false, reason: 'expired' };
  }

  try {
    // Validates the uuid shape. A signature can only be forged with the
    // secret, but if the secret ever leaked this still stops a crafted id
    // reaching a query.
    return { ok: true, userId: toUserId(rawUserId) };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
