import { describe, expect, it } from 'vitest';

import { authBaseUrl, authJwksUrl } from './auth-env';

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
});
