import { createHmac, timingSafeEqual } from 'node:crypto';

import { toUserId, type UserId } from '@/core/types';

/**
 * Bearer tokens for the ingestion endpoint.
 *
 * An iOS Shortcut cannot hold a session cookie, so /api/v1/quick-add needs
 * credentials of its own. The obvious design is a table of API keys, but that
 * is a versioned migration applied to a Neon branch first - correct, and not
 * something to do at the same time as the endpoint it serves.
 *
 * This is stateless instead: the token carries the user id and an HMAC of it.
 * Verifying means recomputing the HMAC, so nothing is stored and nothing is
 * looked up. The properties that matter hold: the id cannot be edited without
 * invalidating the signature, and one user's token proves nothing about
 * another's.
 *
 * What it does NOT have, deliberately and worth knowing: per-token revocation
 * and an expiry. Rotating INGEST_TOKEN_SECRET invalidates every token at once,
 * which is the whole revocation story today. When more than one device or more
 * than one person is issuing these, it becomes a table.
 */

const SECRET_VAR = 'INGEST_TOKEN_SECRET';

function secret(): string {
  const value = process.env[SECRET_VAR];
  // Refusing to start beats defaulting. A fallback secret would mint tokens
  // that verify everywhere, including in production if the variable were ever
  // missing there.
  if (!value || value.length < 32) {
    throw new Error(
      `${SECRET_VAR} must be set and at least 32 characters. Generate one with: openssl rand -base64 32`,
    );
  }
  return value;
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(userId).digest('base64url');
}

export function mintIngestToken(userId: UserId): string {
  return `${userId}.${sign(userId)}`;
}

/**
 * Returns the user the token belongs to, or null.
 *
 * Never throws on malformed input - this reads straight off the network, and
 * an exception here would be a 500 that tells the caller their token was at
 * least shaped correctly.
 */
export function verifyIngestToken(token: string | null | undefined): UserId | null {
  if (!token) {
    return null;
  }

  const separator = token.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }

  const rawUserId = token.slice(0, separator);
  const provided = token.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(rawUserId);
  } catch {
    // Misconfigured server, not a bad token. The route turns this into a 500.
    throw new Error(`${SECRET_VAR} is not configured`);
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // Length must be compared first because timingSafeEqual throws on a mismatch,
  // and the comparison itself is constant-time so an attacker cannot learn the
  // signature one byte at a time from how long the request took.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    // Validates the uuid shape. A signature can only be forged with the secret,
    // but if the secret ever leaked this still stops a crafted id reaching a
    // query.
    return toUserId(rawUserId);
  } catch {
    return null;
  }
}

/** `Authorization: Bearer <token>`, or the raw header if it is just the token. */
export function readBearer(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
