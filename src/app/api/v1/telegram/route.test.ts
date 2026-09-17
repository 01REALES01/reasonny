import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/telegram/handle-update', () => ({
  handleTelegramUpdate: vi.fn(),
}));

import { NextRequest } from 'next/server';

import { handleTelegramUpdate } from '@/clients/telegram/handle-update';

import { POST } from './route';

const SECRET = 'a-webhook-secret-that-is-long-enough';

describe('POST /api/v1/telegram', () => {
  function delivery(body: unknown, secret: string | null = SECRET): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/telegram', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(secret === null ? {} : { 'X-Telegram-Bot-Api-Secret-Token': secret }),
      },
    });
  }

  const update = {
    update_id: 1,
    message: { message_id: 7, chat: { id: 42, type: 'private' }, text: '/start', date: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  });

  it('passes a genuine delivery to the handler', async () => {
    const res = await POST(delivery(update));

    expect(res.status).toBe(200);
    expect(handleTelegramUpdate).toHaveBeenCalledWith(update);
  });

  it.each([
    ['no secret header at all', null],
    ['the wrong secret', 'not-the-secret-at-all-not-even-close'],
    ['a prefix of the real secret', SECRET.slice(0, 10)],
  ])('rejects a delivery with %s', async (_why, secret) => {
    // The path is guessable and this endpoint writes to somebody's ledger.
    // The header is the only thing between it and the open internet.
    const res = await POST(delivery(update, secret));

    expect(res.status).toBe(401);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it('rejects everything when the server has no secret configured', async () => {
    // Fail closed. An unset variable must not mean "let everyone in".
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    const res = await POST(delivery(update));

    expect(res.status).toBe(401);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it('answers 200 to an authenticated body it cannot parse', async () => {
    // Telegram redelivers anything that is not a 200, with backoff, for a day.
    // One unreadable message must not become an infinite retry loop.
    const res = await POST(delivery('{ not json'));

    expect(res.status).toBe(200);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it('answers 200 even when handling the update went wrong', async () => {
    // Belt and braces. The handler swallows its own failures, so reaching this
    // means something broke where it was not supposed to be able to - and a
    // 500 would have Telegram redelivering this update all day.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(handleTelegramUpdate).mockRejectedValue(new Error('neon is asleep'));

    const res = await POST(delivery(update));

    expect(res.status).toBe(200);
  });
});
