import { createRemoteJWKSet, jwtVerify } from 'jose';

import { authBaseUrl, authJwksUrl } from './auth-env';

/**
 * Verification of a Neon Auth token that arrived on its own, not in a cookie.
 *
 * WHO USES THIS
 * -------------
 * Not the PWA. Browser sessions are cookies, read through
 * `getCurrentUser()` in src/lib/session.ts. This is for the surfaces a third
 * party calls: the iOS Shortcut hitting /api/v1/quick-add and the Telegram
 * webhook, which present a token in an Authorization header and have no
 * cookie jar at all.
 *
 * WHY A SIGNATURE CHECK AND NOT A DATABASE LOOKUP
 * ----------------------------------------------
 * The auth server is Neon's, not ours. Verifying a token by querying its
 * tables on every request would add a round trip to a schema we do not own -
 * and these are the two paths with the tightest budget: the Shortcut times out
 * at 30s and Neon cold-starts at up to ~2.6s p95. Instead the token is signed,
 * and we check the signature against the public keys Neon publishes at the
 * JWKS endpoint. No shared secret, no extra query.
 */

// Cached across invocations: the key set is fetched once and refreshed on
// rotation, rather than on every request.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keySet(): ReturnType<typeof createRemoteJWKSet> {
  jwks ??= createRemoteJWKSet(new URL(authJwksUrl()));
  return jwks;
}

export interface VerifiedSession {
  /** neon_auth.user.id - a uuid, which is why profiles.id is uuid too. */
  readonly userId: string;
  readonly email: string | undefined;
  readonly expiresAt: Date;
}

/**
 * Returns the session, or throws. Callers must treat a throw as "not signed
 * in" rather than as an error to report: an expired or forged token is the
 * normal case, not an exception.
 */
export async function verifySessionToken(token: string): Promise<VerifiedSession> {
  const { payload } = await jwtVerify(token, keySet(), {
    issuer: authBaseUrl(),
  });

  if (typeof payload.sub !== 'string' || payload.sub === '') {
    throw new Error('Token carries no subject.');
  }
  if (typeof payload.exp !== 'number') {
    throw new Error('Token carries no expiry.');
  }

  return {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    expiresAt: new Date(payload.exp * 1000),
  };
}
