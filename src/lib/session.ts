import { getAuthServer } from './auth-server';

/**
 * Who is making this request, as far as the server is concerned.
 *
 * WHY A NARROW TYPE INSTEAD OF THE SDK's SESSION OBJECT
 * ----------------------------------------------------
 * Better Auth's user carries fields this app has no opinion about (name,
 * image, emailVerified, and whatever the next beta adds). Handing that object
 * to callers invites them to read from it, and then the app's notion of a user
 * is defined by a managed schema we do not own. Everything downstream needs
 * exactly two things: which row in `profiles`, and an address to show. The
 * rest is Neon's business.
 */
export interface CurrentUser {
  /**
   * neon_auth.user.id - a uuid, which is why profiles.id is uuid too. This is
   * the value every repository takes as its first argument in B4.
   */
  readonly id: string;
  readonly email: string;
}

/**
 * Returns the signed-in user, or null. Null is the ordinary case, not an
 * error: it is what an anonymous visitor looks like.
 *
 * WHAT THIS COSTS
 * ---------------
 * Usually nothing over the network. The proxy mints a signed `session_data`
 * cookie alongside the session cookie, and the SDK checks its signature
 * locally before considering a call to Neon. Only once that cache lapses
 * (5 minutes) does a render pay a round trip. That matters here because Neon
 * cold-starts at up to ~2.6s p95, and LCP has a hard budget of 2.5s (P7).
 *
 * Reading the session opts the route into dynamic rendering - it reads
 * cookies, so it cannot be prerendered. That is correct for anything behind
 * authentication and is exactly why the public landing must not call this.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data, error } = await getAuthServer().getSession();

  // An unreachable auth server and a visitor who never signed in are the same
  // answer to this question: we do not know who this is, so nothing is shown.
  // Callers must not distinguish them - "signed out" is the safe default and
  // "assume it's still them" is how a session outlives its revocation.
  if (error || !data?.user) return null;

  return { id: data.user.id, email: data.user.email };
}

/**
 * The same thing, for code that has no sensible behaviour for an anonymous
 * caller: Server Actions and route handlers that write.
 *
 * A page can render a signed-out state; a mutation cannot invent a user id to
 * write against. Throwing here means such a caller cannot silently continue
 * with `undefined` and land a row belonging to nobody.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');
  return user;
}
