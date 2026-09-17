import { describe, expect, it, vi } from 'vitest';

import { setWebhook } from './telegram';

describe('setWebhook', () => {
  it.each([
    ['base64 padding', 'ZXhhbXBsZS1ub3QtYS1yZWFsLXNlY3JldC1hdC1hbGw='],
    ['base64 slashes', 'ab/cd+ef'],
    ['a space', 'not a secret'],
    ['nothing at all', ''],
  ])('refuses a secret with %s before calling Telegram', async (_why, secret) => {
    // Telegram answers "Bad Request: secret token contains illegal characters"
    // at registration time - long after anyone would connect that to how the
    // value was generated. `openssl rand -base64 32` produces exactly this.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await setWebhook('https://example.com/api/v1/telegram', secret);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain('openssl rand -hex 32');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
