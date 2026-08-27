import { createRemoteJWKSet, jwtVerify } from 'jose';

import { authBaseUrl, authJwksUrl } from './auth-env';

/**
 * Server-side verification of the session Neon Auth issued.
 *
 * WHY A JWT AND NOT A DATABASE LOOKUP
 * -----------------------------------
 * The auth server is Neon's, not ours. Verifying a session by querying its
 * tables on every request would add a round trip to a schema we do not own.
 * Instead the token is signed, and we check the signature against the public
 * keys Neon publishes at the JWKS endpoint. No shared secret, no extra query.
 *
 * WHY THE TOKEN LIVES IN AN httpOnly COOKIE, NEVER IN localStorage
 * ---------------------------------------------------------------
 * Anything in localStorage is readable by any JavaScript on the page. One
 * compromised dependency - and a Next app has hundreds - reads the token and
 * the attacker has the session. An httpOnly cookie is not reachable from
 * JavaScript at all: the browser attaches it and script cannot read it, so the
 * same compromised dependency gets nothing. The trade is that cookies ride
 * along automatically, which is what CSRF exploits, and that is handled by
 * SameSite plus the origin checks below - a solved problem, unlike "an
 * attacker can read your token", which has no mitigation.
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
