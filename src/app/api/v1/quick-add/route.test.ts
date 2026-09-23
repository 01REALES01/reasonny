import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/profile.repository', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/core/repositories/ingestion-failure.repository', () => ({
  recordIngestionFailure: vi.fn(),
}));

vi.mock('@/core/services/transaction.service', () => ({
  recordTransaction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/core/services/notification.service', () => ({
  notifyIfUncategorized: vi.fn().mockResolvedValue({ sent: false, reason: 'not_linked' }),
}));

/**
 * `after` throws outside a real request scope, and the route is called here as
 * a plain function. Running the callback inline instead of dropping it is the
 * point: the whole reason the prompt lives in `after` is that it must not
 * block the Shortcut, and a no-op mock would let that wiring rot untested.
 */
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => void fn() };
});

import { NextRequest } from 'next/server';

import { recordIngestionFailure } from '@/core/repositories/ingestion-failure.repository';
import { getProfile } from '@/core/repositories/profile.repository';
import { notifyIfUncategorized } from '@/core/services/notification.service';
import { recordTransaction } from '@/core/services/transaction.service';
import { mintIngestToken } from '@/lib/ingest-token';
import { toUserId } from '@/core/types';

import { POST } from './route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * A card purchase, structurally real but with an invented amount and a generic
 * merchant. Nothing here came from a statement.
 */
const CARD_SMS =
  'Bancolombia: NOMBRE, con tu Tarjeta 1111 pagaste $45,000 desde tu cuenta *9999 a la llave 3000000001 el 21/08/2026 a las 17:09.';

describe('POST /api/v1/quick-add', () => {
  const userId = toUserId(USER_ID);

  function request(body: unknown, token: string): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/quick-add', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /** What recordTransaction was handed, for the one call it received. */
  function recordedInput() {
    return vi.mocked(recordTransaction).mock.calls[0]?.[2];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.INGEST_TOKEN_SECRET = 'a'.repeat(48);

    vi.mocked(getProfile).mockResolvedValue({
      id: USER_ID,
      baseCurrency: 'COP',
      locationEnabled: true,
    } as never);
    vi.mocked(recordTransaction).mockResolvedValue({
      ok: true,
      transaction: { id: 'tx-1' } as never,
      isDuplicate: false,
      autoCategorized: false,
      appliedCategory: null,
    });
  });

  it('stores a parsed card purchase', async () => {
    const res = await POST(request({ text: CARD_SMS }, mintIngestToken(userId)));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ stored: true, duplicate: false });
    expect(recordedInput()).toMatchObject({
      source: 'sms_shortcut',
      locationSource: 'shortcut',
      categoryId: null,
    });
  });

  it('refuses a token that does not verify, and leaves a trace', async () => {
    const res = await POST(request({ text: CARD_SMS }, 'not-a-token'));

    expect(res.status).toBe(401);
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(recordIngestionFailure).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ error: 'unauthorized' }),
    );
  });

  it('answers an unreadable message with 200 so Shortcuts does not retry forever', async () => {
    const res = await POST(
      request({ text: 'Banco Inventado: algo pasó' }, mintIngestToken(userId)),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ stored: false, reason: 'unknown_bank' });
  });

  it('reads the fields whatever case the iPhone typed them in', async () => {
    // THE REGRESSION: the first user after the author. iOS capitalises the
    // first letter typed into a Shortcuts field, so a setup that followed the
    // guide exactly sent `Text`, and a readable SMS was rejected whole.
    const res = await POST(
      request(
        { Text: CARD_SMS, Latitude: '4.65', ' LONGITUDE ': '-74.05' },
        mintIngestToken(userId),
      ),
    );

    expect(res.status).toBe(201);
    expect(recordedInput()?.location).toMatchObject({ latitude: 4.65, longitude: -74.05 });
  });

  it('prefers the exact spelling when a body carries both', async () => {
    await POST(
      request({ Text: 'Banco Inventado: algo pasó', text: CARD_SMS }, mintIngestToken(userId)),
    );

    expect(recordTransaction).toHaveBeenCalled();
  });

  describe('coordinates from Shortcuts', () => {
    it('reads the numbers Shortcuts sends as strings', async () => {
      await POST(
        request(
          { text: CARD_SMS, latitude: '4.65', longitude: '-74.05', locationAccuracyM: '25' },
          mintIngestToken(userId),
        ),
      );

      expect(recordedInput()?.location).toEqual({
        latitude: 4.65,
        longitude: -74.05,
        accuracyM: 25,
      });
    });

    it('ignores an accuracy Shortcuts could not fill in', async () => {
      const res = await POST(
        request(
          { text: CARD_SMS, latitude: '4.65', longitude: '-74.05', locationAccuracyM: '' },
          mintIngestToken(userId),
        ),
      );

      expect(res.status).toBe(201);
      expect(recordedInput()?.location).toMatchObject({ accuracyM: undefined });
    });

    it('reads a coordinate written with a decimal comma', async () => {
      // The "Latitude" magic variable renders in the phone's locale, and on a
      // Spanish iPhone that is "4,7110". Number() of that is NaN.
      await POST(
        request(
          { text: CARD_SMS, latitude: '4,7110', longitude: '-74,0721' },
          mintIngestToken(userId),
        ),
      );

      expect(recordedInput()?.location).toMatchObject({
        latitude: 4.711,
        longitude: -74.0721,
      });
    });

    it.each([
      ['blank, because the phone had no fix', ''],
      ['not a number at all', 'no disponible'],
      ['outside the world', '91'],
    ])('stores the expense anyway when the coordinate is %s', async (_why, latitude) => {
      // THE REGRESSION THIS BLOCK EXISTS FOR.
      //
      // Every one of these used to fail the WHOLE body with 400 invalid_body,
      // so a perfectly readable bank SMS was thrown away because of a field
      // that was never required. The location is optional. The spend is not.
      const res = await POST(
        request({ text: CARD_SMS, latitude, longitude: '-74.05' }, mintIngestToken(userId)),
      );

      expect(res.status).toBe(201);
      expect(recordTransaction).toHaveBeenCalled();
      expect(recordedInput()?.location).toMatchObject({ latitude: undefined });
    });
  });

  it('asks for a category after the response, never during it', async () => {
    // The Shortcut times out at 30 s and api.telegram.org is not ours.
    await POST(request({ text: CARD_SMS }, mintIngestToken(userId)));

    expect(notifyIfUncategorized).toHaveBeenCalledWith(
      userId,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ provider: 'telegram' }),
    );
  });

  it('does not ask again about a message it already stored', async () => {
    vi.mocked(recordTransaction).mockResolvedValue({
      ok: true,
      transaction: { id: 'tx-1' } as never,
      isDuplicate: true,
      autoCategorized: false,
      appliedCategory: null,
    });

    await POST(request({ text: CARD_SMS }, mintIngestToken(userId)));

    expect(notifyIfUncategorized).not.toHaveBeenCalled();
  });

  it('reports a duplicate as 200 without claiming it stored anything', async () => {
    vi.mocked(recordTransaction).mockResolvedValue({
      ok: true,
      transaction: { id: 'tx-1' } as never,
      isDuplicate: true,
      autoCategorized: false,
      appliedCategory: null,
    });

    const res = await POST(request({ text: CARD_SMS }, mintIngestToken(userId)));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ stored: false, duplicate: true });
  });
});
