import { beforeEach, describe, expect, it } from 'vitest';

import { toUserId } from '@/core/types';

import {
  LINK_TOKEN_TTL_SECONDS,
  mintLinkToken,
  verifyLinkToken,
} from './telegram-link-token';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

describe('telegram link token', () => {
  const userId = toUserId(USER_ID);
  const now = Date.UTC(2026, 8, 17, 12, 0, 0);

  beforeEach(() => {
    process.env.INGEST_TOKEN_SECRET = 'a'.repeat(48);
  });

  it('round-trips the user it was minted for', () => {
    const token = mintLinkToken(userId, now);

    expect(verifyLinkToken(token, now)).toEqual({ ok: true, userId: USER_ID });
  });

  it('stops working once the window has passed', () => {
    const token = mintLinkToken(userId, now);
    const afterwards = now + (LINK_TOKEN_TTL_SECONDS + 1) * 1000;

    expect(verifyLinkToken(token, afterwards)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a token whose expiry was edited to a later one', () => {
    // The whole point of signing the expiry: it cannot be moved without the
    // secret, so a link found in an old screenshot cannot be revived.
    const token = mintLinkToken(userId, now);
    const [id, expiry, sig] = token.split('.');
    const stretched = `${id}.${Number(expiry) + 86_400}.${sig}`;

    expect(verifyLinkToken(stretched, now)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it("refuses a token whose user id was swapped for somebody else's", () => {
    const token = mintLinkToken(userId, now);
    const [, expiry, sig] = token.split('.');

    expect(verifyLinkToken(`${OTHER_ID}.${expiry}.${sig}`, now)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('refuses an ingest token, which signs the same user with no domain tag', async () => {
    // Domain separation is the reason the two families can share a secret.
    const { mintIngestToken } = await import('./ingest-token');

    expect(verifyLinkToken(mintIngestToken(userId), now).ok).toBe(false);
  });

  it.each([
    ['nothing at all', ''],
    ['free text after /start', 'hola'],
    ['too few parts', `${USER_ID}.999`],
    ['a non-numeric expiry', `${USER_ID}.mañana.abc`],
  ])('answers instead of throwing on %s', (_why, token) => {
    expect(verifyLinkToken(token, now)).toMatchObject({ ok: false });
  });

  it('mints a different token for a different user', () => {
    expect(mintLinkToken(userId, now)).not.toBe(mintLinkToken(toUserId(OTHER_ID), now));
  });
});
