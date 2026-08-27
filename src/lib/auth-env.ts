/**
 * Neon Auth endpoints, read once and validated.
 *
 * Neon HOSTS the Better Auth server: it lives on the project's own compute
 * endpoint, not inside this app. So there is no auth server to configure here -
 * only a client that talks to it, and server-side verification of the tokens it
 * issues.
 */
type Env = Record<string, string | undefined>;

function required(name: string, env: Env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. It is written by "neon config apply", not by hand. See .env.example.`,
    );
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL.`);
  }
  return value;
}

export function authBaseUrl(env: Env = process.env): string {
  return required('NEON_AUTH_BASE_URL', env);
}

export function authJwksUrl(env: Env = process.env): string {
  return required('NEON_AUTH_JWKS_URL', env);
}
