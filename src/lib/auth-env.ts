/**
 * Neon Auth endpoints and secrets, read once and validated.
 *
 * Neon HOSTS the Better Auth server: it lives on the project's own compute
 * endpoint, not inside this app. So there is no auth server to configure here -
 * only a proxy in front of it (src/app/api/auth), a client that talks to that
 * proxy, and server-side verification of the tokens it issues.
 */
type Env = Record<string, string | undefined>;

function present(name: string, env: Env, hint: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. ${hint} See .env.example.`);
  }
  return value;
}

// Both URLs come from the Neon CLI. Typing them by hand is how the app ends up
// pointed at a different project's auth server than its database.
const WRITTEN_BY_CLI = 'It is written by "neon config apply", not by hand.';

function requiredUrl(name: string, env: Env): string {
  const value = present(name, env, WRITTEN_BY_CLI);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL.`);
  }
  return value;
}

export function authBaseUrl(env: Env = process.env): string {
  return requiredUrl('NEON_AUTH_BASE_URL', env);
}

export function authJwksUrl(env: Env = process.env): string {
  return requiredUrl('NEON_AUTH_JWKS_URL', env);
}

/**
 * HMAC key for the `session_data` cookie the proxy mints - a signed cache of
 * the session so a Server Component render does not call Neon on every paint.
 *
 * Unlike the two URLs above, this one is OURS: `neon config apply` does not
 * write it, and it must differ between local and production. Nothing about the
 * session is encrypted with it - the cookie is signed, not sealed - but anyone
 * holding it can forge a session_data payload for any user id, which is a full
 * account takeover. It is the one secret in this file that is a secret.
 *
 * The 32-character floor is not ours either: @neondatabase/auth throws below
 * it (validateCookieConfig). Checking here means the error names the variable
 * and points at the fix instead of surfacing from inside the SDK.
 */
export function authCookieSecret(env: Env = process.env): string {
  const value = present(
    'NEON_AUTH_COOKIE_SECRET',
    env,
    'Generate one with: openssl rand -base64 32',
  );
  if (value.length < 32) {
    throw new Error(
      'NEON_AUTH_COOKIE_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32',
    );
  }
  return value;
}
