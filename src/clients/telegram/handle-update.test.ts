import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/services/telegram-link.service', () => ({
  linkChatWithToken: vi.fn(),
  resolveChat: vi.fn(),
}));

vi.mock('@/infrastructure/messaging/telegram', () => ({
  sendMessage: vi.fn().mockResolvedValue({ ok: true, result: {} }),
}));

import { linkChatWithToken, resolveChat } from '@/core/services/telegram-link.service';
import { sendMessage } from '@/infrastructure/messaging/telegram';

import { handleTelegramUpdate, localeFor } from './handle-update';

const CHAT_ID = 4_242_424_242;

function update(text: string, extras: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    message: {
      message_id: 7,
      chat: { id: CHAT_ID, type: 'private' },
      from: { id: 99, is_bot: false, language_code: 'es' },
      text,
      date: 0,
      ...extras,
    },
  } as never;
}

/** The text of the one message the bot sent back. */
function reply(): string {
  return String(vi.mocked(sendMessage).mock.calls[0]?.[1] ?? '');
}

describe('the Telegram client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sendMessage).mockResolvedValue({ ok: true, result: {} } as never);
    vi.mocked(resolveChat).mockResolvedValue(null);
  });

  describe('language', () => {
    it.each([
      ['en', 'en'],
      ['en-GB', 'en'],
      ['EN-us', 'en'],
      ['es', 'es'],
      ['es-CO', 'es'],
      ['pt-BR', 'es'],
      [undefined, 'es'],
    ])('answers a %s speaker in %s', (code, expected) => {
      const from = code === undefined ? undefined : { id: 1, is_bot: false, language_code: code };
      expect(localeFor(from as never)).toBe(expected);
    });
  });

  describe('/start', () => {
    it('links the chat and says so', async () => {
      vi.mocked(linkChatWithToken).mockResolvedValue({
        ok: true,
        profile: {} as never,
        alreadyLinked: false,
      });

      await handleTelegramUpdate(update('/start abc.123.sig'));

      expect(linkChatWithToken).toHaveBeenCalledWith(BigInt(CHAT_ID), 'abc.123.sig');
      expect(reply()).toContain('conectados');
    });

    it('accepts the form Telegram uses in groups, /start@thebot <token>', async () => {
      vi.mocked(linkChatWithToken).mockResolvedValue({
        ok: true,
        profile: {} as never,
        alreadyLinked: false,
      });

      await handleTelegramUpdate(update('/start@reasonny_JP_bot abc.123.sig'));

      expect(linkChatWithToken).toHaveBeenCalledWith(BigInt(CHAT_ID), 'abc.123.sig');
    });

    it('tells an expired link apart from a broken one, because only one is actionable', async () => {
      vi.mocked(linkChatWithToken).mockResolvedValue({ ok: false, reason: 'expired' });

      await handleTelegramUpdate(update('/start abc.123.sig'));

      expect(reply()).toContain('caducó');
    });

    it('gives a forged token the vague answer', async () => {
      vi.mocked(linkChatWithToken).mockResolvedValue({ ok: false, reason: 'invalid' });

      await handleTelegramUpdate(update('/start forged'));

      expect(reply()).toContain('No pude leer');
    });

    it('explains itself to someone who found the bot in search', async () => {
      await handleTelegramUpdate(update('/start'));

      expect(linkChatWithToken).not.toHaveBeenCalled();
      expect(reply()).toContain('Perfil');
    });

    it('does not re-link a chat that was already linked', async () => {
      vi.mocked(linkChatWithToken).mockResolvedValue({
        ok: true,
        profile: {} as never,
        alreadyLinked: true,
      });

      await handleTelegramUpdate(update('/start abc.123.sig'));

      expect(reply()).toContain('ya estaba conectado');
    });
  });

  describe('everything else', () => {
    it('points an unlinked chat at the app instead of answering', async () => {
      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(resolveChat).toHaveBeenCalledWith(BigInt(CHAT_ID));
      expect(reply()).toContain('no está conectado');
    });

    it('answers a linked chat, pending the text parser', async () => {
      vi.mocked(resolveChat).mockResolvedValue({ id: 'u1' } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply()).toContain('Todavía no sé');
    });

    it('ignores a group chat entirely', async () => {
      // A shared audience has no business seeing a personal ledger, and a
      // group id lives in a different range.
      await handleTelegramUpdate({
        update_id: 1,
        message: {
          message_id: 7,
          chat: { id: -100, type: 'supergroup' },
          text: '/start abc.123.sig',
          date: 0,
        },
      } as never);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(linkChatWithToken).not.toHaveBeenCalled();
    });

    it('ignores an update with no text, such as a photo', async () => {
      await handleTelegramUpdate({
        update_id: 1,
        message: { message_id: 7, chat: { id: CHAT_ID, type: 'private' }, date: 0 },
      } as never);

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores an update that carries nothing it handles', async () => {
      await handleTelegramUpdate({ update_id: 1 } as never);

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  it('swallows a failure rather than letting the webhook answer non-200', async () => {
    vi.mocked(resolveChat).mockRejectedValue(new Error('neon is asleep'));

    await expect(handleTelegramUpdate(update('hola'))).resolves.toBeUndefined();
  });
});
