import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toUserId } from '@/core/types';

import { mintIngestToken, readBearer, verifyIngestToken } from './ingest-token';

const USER_A = toUserId('11111111-1111-4111-8111-111111111111');
const USER_B = toUserId('22222222-2222-4222-8222-222222222222');

const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);

describe('Ingestion tokens', () => {
  const original = process.env.INGEST_TOKEN_SECRET;

  beforeEach(() => {
    process.env.INGEST_TOKEN_SECRET = SECRET_A;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.INGEST_TOKEN_SECRET;
    } else {
      process.env.INGEST_TOKEN_SECRET = original;
    }
  });

  it('round-trips the user it was minted for', () => {
    expect(verifyIngestToken(mintIngestToken(USER_A))).toBe(USER_A);
  });

  /**
   * The whole point of signing the id. Without the HMAC, swapping the uuid in
   * a token would write another person's transactions - the endpoint trusts
   * this value and nothing else.
   */
  it('rejects a token whose user id was swapped', () => {
    const forged = `${USER_B}.${mintIngestToken(USER_A).split('.')[1]}`;

    expect(verifyIngestToken(forged)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = mintIngestToken(USER_A);
    process.env.INGEST_TOKEN_SECRET = SECRET_B;

    expect(verifyIngestToken(token)).toBeNull();
  });

  it('gives two users different signatures', () => {
    const a = mintIngestToken(USER_A).split('.')[1];
    const b = mintIngestToken(USER_B).split('.')[1];

    expect(a).not.toBe(b);
  });

  /**
   * Rotating the secret is the only revocation this design has, so it has to
   * actually invalidate what was already issued.
   */
  it('invalidates every existing token when the secret rotates', () => {
    const before = mintIngestToken(USER_A);
    process.env.INGEST_TOKEN_SECRET = SECRET_B;

    expect(verifyIngestToken(before)).toBeNull();
    expect(verifyIngestToken(mintIngestToken(USER_A))).toBe(USER_A);
  });

  it('returns null rather than throwing on malformed input', () => {
    for (const junk of [null, undefined, '', '.', 'nodot', `${USER_A}.`, `.sig`, 'a.b.c']) {
      expect(() => verifyIngestToken(junk)).not.toThrow();
      expect(verifyIngestToken(junk)).toBeNull();
    }
  });

  /**
   * A short or absent secret must stop the server, not fall back to a default.
   * A default would mint tokens that verify on any deployment that shares it.
   */
  it('refuses to sign without a long enough secret', () => {
    process.env.INGEST_TOKEN_SECRET = 'too-short';
    expect(() => mintIngestToken(USER_A)).toThrow(/at least 32/);

    delete process.env.INGEST_TOKEN_SECRET;
    expect(() => mintIngestToken(USER_A)).toThrow(/must be set/);
  });

  it('reads the bearer scheme case-insensitively and ignores anything else', () => {
    expect(readBearer('Bearer abc')).toBe('abc');
    expect(readBearer('bearer  abc')).toBe('abc');
    expect(readBearer('Basic abc')).toBeNull();
    expect(readBearer(null)).toBeNull();
  });
});
