import { describe, expect, it } from 'vitest';

import { authBaseUrl, authCookieSecret, authJwksUrl } from './auth-env';

const BASE = 'https://ep-example-123456.us-east-1.aws.neon.tech/realmoney/auth';

describe('auth environment', () => {
  it('returns the configured endpoints', () => {
    expect(authBaseUrl({ NEON_AUTH_BASE_URL: BASE })).toBe(BASE);
    expect(authJwksUrl({ NEON_AUTH_JWKS_URL: `${BASE}/.well-known/jwks.json` })).toBe(
      `${BASE}/.well-known/jwks.json`,
    );
  });

  // These are written by `neon config apply`. A missing one means the service
  // was never provisioned, and saying so beats a cryptic fetch failure later.
  it('says which variable is missing rather than failing at fetch time', () => {
    expect(() => authBaseUrl({})).toThrow(/NEON_AUTH_BASE_URL is not set/);
    expect(() => authJwksUrl({})).toThrow(/NEON_AUTH_JWKS_URL is not set/);
    expect(() => authBaseUrl({ NEON_AUTH_BASE_URL: '   ' })).toThrow(/is not set/);
  });

  it('rejects a value that is not a URL', () => {
    expect(() => authBaseUrl({ NEON_AUTH_BASE_URL: 'ep-example.neon.tech' })).toThrow(
      /not a valid URL/,
    );
  });

  // 32 characters is the SDK's floor, and it enforces it too. Checking here is
  // about WHERE the error surfaces: a placeholder like "changeme" should name
  // the variable at boot, not fail somewhere inside @neondatabase/auth.
  it('rejects a cookie secret shorter than 32 characters', () => {
    const short = 'a'.repeat(31);
    expect(() => authCookieSecret({ NEON_AUTH_COOKIE_SECRET: short })).toThrow(
      /at least 32 characters/,
    );
    expect(authCookieSecret({ NEON_AUTH_COOKIE_SECRET: `${short}a` })).toHaveLength(32);
  });

  // This one is NOT written by `neon config apply`, so the message must not
  // send the reader off to run the CLI and wonder why nothing changed.
  it('tells the reader how to generate the cookie secret', () => {
    expect(() => authCookieSecret({})).toThrow(/NEON_AUTH_COOKIE_SECRET is not set/);
    expect(() => authCookieSecret({})).toThrow(/openssl rand/);
    expect(() => authCookieSecret({})).not.toThrow(/neon config apply/);
  });
});
