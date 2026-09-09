import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';
import {
  createAuthServer,
  extractNeonAuthCookies,
  type CookieOptions,
  type NeonAuthConfig,
  type NeonAuthServer,
  type RequestContext,
} from '@neondatabase/auth/server';
import { cookies, headers } from 'next/headers';

import { authBaseUrl, authCookieSecret } from './auth-env';

/**
 * The server half of Neon Auth: the same API the browser client has, but
 * speaking for the current request.
 *
 * WHY THE APP PROXIES NEON AUTH INSTEAD OF CALLING IT FROM THE BROWSER
 * -------------------------------------------------------------------
 * Neon's auth server lives on a different host than this app. A browser
 * calling it directly sends `credentials: 'include'` cross-site, so the
 * session cookie it sets is a THIRD-PARTY cookie. Safari blocks those
 * outright - it never stores the cookie, so sign-in returns 200 and the next
 * page load is signed out. Chrome still allows them, which is exactly why the
 * bug survives local testing and dies on the phone. This app is installed as a
 * PWA on iOS; Safari is not an edge case here, it is the platform.
 *
 * So every auth call goes to our own origin (src/app/api/auth/[...path]) and
 * is forwarded from the server. The cookies come back first-party. That is
 * also what makes the Google OAuth return trip work later, and what lets the
 * SDK refresh a session without the browser holding the token.
 *
 * WHY TWO INSTANCES
 * -----------------
 * `getAuthHandlers()` is the SDK's own Next.js wiring, used by the catch-all
 * route. `getAuthServer()` is the same toolkit with one behaviour changed, and
 * it is what reads the session during a render. The difference is cookie
 * writes - see the note on requestContext below.
 */

function authConfig(): NeonAuthConfig {
  return {
    baseUrl: authBaseUrl(),
    // sameSite stays at the SDK default 'lax' and must: 'strict' would break
    // the Google OAuth return trip, because coming back from
    // accounts.google.com is a cross-site top-level navigation and a strict
    // cookie is not sent on one. The user would land signed out.
    cookies: { secret: authCookieSecret() },
  };
}

/**
 * Cookie writes are legal in a Route Handler and in a Server Action, and
 * illegal while a Server Component renders: Next seals the cookie store during
 * render and `.set()` throws ReadonlyRequestCookiesError. Every throw site in
 * next/headers for `.set()` is that one check, so a throw here means exactly
 * "this phase cannot write cookies" and never a malformed value.
 *
 * Dropping the write is the right answer, not an error to report. What is
 * being dropped is Better Auth's periodic re-issue of the SAME session token
 * with a later expiry - a sliding window, not a rotation. Losing one costs the
 * user a slightly earlier re-login; letting it throw costs them the page.
 */
async function requestContext(): Promise<RequestContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return {
    // Only the __Secure-neon-auth.* cookies are forwarded upstream. Neon has no
    // business receiving the rest of this app's cookies.
    getCookies: () => extractNeonAuthCookies(headerStore),
    setCookie: (name: string, value: string, options: CookieOptions) => {
      try {
        cookieStore.set(name, value, options);
      } catch {
        // Server Component render phase. See the note above.
      }
    },
    getHeader: (name: string) => headerStore.get(name),
    // Neon enforces a trusted-origin policy on the forwarded call, and a
    // same-origin GET navigation carries no Origin header - hence the Referer
    // fallback, trimmed to scheme://host:port.
    getOrigin: () =>
      headerStore.get('origin') ?? headerStore.get('referer')?.split('/').slice(0, 3).join('/') ?? '',
    getFramework: () => 'nextjs',
  };
}

type AuthRouteHandlers = ReturnType<NeonAuth['handler']>;
type AuthProxy = ReturnType<NeonAuth['middleware']>;

let server: NeonAuthServer | undefined;
let neonAuth: NeonAuth | undefined;
let handlers: AuthRouteHandlers | undefined;
let proxy: AuthProxy | undefined;

/**
 * The SDK's Next.js instance, built once. Both the catch-all route handlers and
 * the proxy come off it, so they share one config and one validation of the
 * cookie secret.
 */
function getNeonAuth(): NeonAuth {
  neonAuth ??= createNeonAuth(authConfig());
  return neonAuth;
}

/**
 * Reads the session for the current request. Safe to call while a Server
 * Component renders, which is the whole reason it exists.
 *
 * Lazily built, then memoised - same reasoning as the database pool: reading
 * the secret at module scope would make `next build` demand credentials it has
 * no business needing.
 */
export function getAuthServer(): NeonAuthServer {
  const { baseUrl, cookies: cookieConfig } = authConfig();
  server ??= createAuthServer({
    baseUrl,
    context: requestContext,
    cookieSecret: cookieConfig.secret,
  });
  return server;
}

/**
 * The route handlers for the proxy mounted at src/app/api/auth/[...path].
 *
 * Memoised for the same reason and resolved on the first REQUEST, not at
 * module load: a route file that reads secrets at module scope makes
 * `next build` fail without them, and the build has no business holding a
 * cookie signing key to emit static assets.
 */
export function getAuthHandlers(): AuthRouteHandlers {
  handlers ??= getNeonAuth().handler();
  return handlers;
}

/**
 * The request proxy mounted at src/proxy.ts.
 *
 * WHY THIS EXISTS AT ALL - IT IS WHAT KEEPS THE USER SIGNED IN
 * ------------------------------------------------------------
 * Better Auth slides the session forward: past `updateAge` it re-issues the
 * SAME token with a later expiry, as a Set-Cookie on the get-session response.
 * That refresh only counts if the cookie reaches the browser.
 *
 * Every read of the session in this app happened inside a Server Component
 * render, and a render cannot write cookies - requestContext above swallows the
 * write, correctly, because throwing would cost the user the page. So the
 * refresh was minted and dropped on every single navigation, and the cookie
 * kept the expiry it was born with. The session died a fixed number of days
 * after sign-in no matter how much the app was used. That is the "it asks me to
 * sign in again" bug, and no amount of caching fixes it.
 *
 * A proxy runs before the render, where writing cookies is legal. It refreshes
 * the session token and re-mints the signed session_data cache on each
 * navigation, so the window actually slides and the render reads it locally
 * instead of paying a round trip to Neon.
 */
export function getAuthProxy(): AuthProxy {
  proxy ??= getNeonAuth().middleware({ loginUrl: '/sign-in' });
  return proxy;
}
