import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/ingestion-failure.repository', () => ({
  recordIngestionFailure: vi.fn(),
}));

vi.mock('@/core/services/transaction.service', () => ({
  recordTransaction: vi.fn(),
}));

import { uuidFromSeed } from '@/core/idempotency';
import { recordIngestionFailure } from '@/core/repositories/ingestion-failure.repository';
import { recordTransaction } from '@/core/services/transaction.service';
import { toUserId } from '@/core/types';

import { captureFromText } from './chat-capture.service';

const userId = toUserId('11111111-1111-4111-8111-111111111111');
const profile = { id: userId, baseCurrency: 'COP', locationEnabled: true } as never;
const options = { source: 'telegram_text', externalId: 'telegram:42:7' } as const;

/** What recordTransaction was handed on its one call. */
function recorded() {
  return vi.mocked(recordTransaction).mock.calls[0]?.[2];
}

describe('capturing a spend from a line of text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(recordTransaction).mockResolvedValue({
      ok: true,
      transaction: { id: 'tx-1' } as never,
      isDuplicate: false,
      autoCategorized: false,
      appliedCategory: null,
    });
  });

  it('files what the parser read', async () => {
    const result = await captureFromText(userId, profile, '12000 juan valdez', options);

    expect(result.ok).toBe(true);
    expect(recorded()).toMatchObject({
      amountMinor: 1_200_000n,
      type: 'expense',
      merchant: 'juan valdez',
      source: 'telegram_text',
    });
  });

  it('keys idempotency to the EVENT, so a second identical coffee still counts', async () => {
    // Hashing the words would silently drop the second one.
    await captureFromText(userId, profile, '12000 juan valdez', options);

    expect(recorded()?.idempotencyKey).toBe(uuidFromSeed('telegram:42:7'));
    expect(recorded()?.idempotencyKey).not.toBe(uuidFromSeed('telegram:42:8'));
  });

  it('stores no coordinate, because a chat message has no GPS', async () => {
    await captureFromText(userId, profile, '12000 juan valdez', options);

    expect(recorded()?.location).toBeNull();
    expect(recorded()?.locationSource).toBe('manual');
  });

  it('never invents a category', async () => {
    await captureFromText(userId, profile, '12000 juan valdez', options);

    expect(recorded()?.categoryId).toBeNull();
  });

  describe('what it refuses', () => {
    it('does not record a transaction it could not read', async () => {
      const result = await captureFromText(userId, profile, 'hola', options);

      expect(result).toEqual({ ok: false, reason: 'no_amount' });
      expect(recordTransaction).not.toHaveBeenCalled();
    });

    it('keeps a failure that looks like a real attempt', async () => {
      // "12000" alone: an amount was found, the name was not. That is evidence.
      await captureFromText(userId, profile, '12000', options);

      expect(recordIngestionFailure).toHaveBeenCalledWith(userId, {
        source: 'telegram_text',
        rawPayload: { text: '12000', externalId: 'telegram:42:7' },
        error: 'no_merchant',
      });
    });

    it('does not file conversation in the review queue (P2)', async () => {
      // A greeting in the failure log buries the one message that mattered.
      await captureFromText(userId, profile, 'hola, buenos días', options);

      expect(recordIngestionFailure).not.toHaveBeenCalled();
    });

    it('keeps an unreadable message that at least contains a number', async () => {
      await captureFromText(userId, profile, 'pagué como 20 mil en algo', options);

      expect(recordIngestionFailure).toHaveBeenCalled();
    });

    it('answers normally when recording the failure itself fails', async () => {
      // Losing the diagnostic must not also lose the reply to the user.
      vi.mocked(recordIngestionFailure).mockRejectedValue(new Error('neon is asleep'));

      await expect(captureFromText(userId, profile, '12000', options)).resolves.toEqual({
        ok: false,
        reason: 'no_merchant',
      });
    });

    it('records a write that was refused, not just one that was unreadable', async () => {
      vi.mocked(recordTransaction).mockResolvedValue({ ok: false, reason: 'unknown_account' });

      const result = await captureFromText(userId, profile, '12000 juan valdez', options);

      expect(result).toEqual({ ok: false, reason: 'unknown_account' });
      expect(recordIngestionFailure).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ error: 'unknown_account' }),
      );
    });
  });
});
