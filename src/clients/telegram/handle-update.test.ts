import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/services/telegram-link.service', () => ({
  linkChatWithToken: vi.fn(),
  resolveChat: vi.fn(),
}));

vi.mock('@/core/services/chat-capture.service', () => ({
  captureFromText: vi.fn(),
  shouldOfferCommandsTip: vi.fn(),
}));

vi.mock('@/core/services/analytics.service', () => ({
  getDashboardData: vi.fn(),
  getMonthViewData: vi.fn(),
}));

vi.mock('@/core/services/notification.service', () => ({
  notifyIfUncategorized: vi.fn(),
  resolvePromptContext: vi.fn(),
  answerCategoryPrompt: vi.fn(),
  createCategoryForPrompt: vi.fn(),
  listPromptChoices: vi.fn(),
  trackFollowUpPrompt: vi.fn(),
}));

vi.mock('@/infrastructure/messaging/telegram', () => ({
  sendMessage: vi.fn(),
  answerCallbackQuery: vi.fn(),
  editMessageText: vi.fn(),
  editMessageReplyMarkup: vi.fn(),
}));

import { getDashboardData, getMonthViewData } from '@/core/services/analytics.service';
import { captureFromText, shouldOfferCommandsTip } from '@/core/services/chat-capture.service';
import {
  answerCategoryPrompt,
  createCategoryForPrompt,
  listPromptChoices,
  notifyIfUncategorized,
  resolvePromptContext,
  trackFollowUpPrompt,
} from '@/core/services/notification.service';
import { linkChatWithToken, resolveChat } from '@/core/services/telegram-link.service';
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  editMessageText,
  sendMessage,
} from '@/infrastructure/messaging/telegram';

import { handleTelegramUpdate, localeFor } from './handle-update';

const CHAT_ID = 4_242_424_242;
const MESSAGE_ID = 7;
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
// A real uuid: toUserId is a branded constructor and throws on anything else,
// and the handler swallows throws - so a fake id here fails every test silently.
const USER_ID = '11111111-1111-4111-8111-111111111111';

function update(text: string, extras: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    message: {
      message_id: MESSAGE_ID,
      chat: { id: CHAT_ID, type: 'private' },
      from: { id: 99, is_bot: false, language_code: 'es' },
      text,
      date: 0,
      ...extras,
    },
  } as never;
}

function tap(data: string) {
  return {
    update_id: 1,
    callback_query: {
      id: 'cb-1',
      from: { id: 99, is_bot: false, language_code: 'es' },
      data,
      message: {
        message_id: MESSAGE_ID,
        chat: { id: CHAT_ID, type: 'private' },
        date: 0,
      },
    },
  } as never;
}

/** $12.000 COP, in minor units. */
const AMOUNT = 1_200_000n;

const transaction = {
  id: 'tx-1',
  amountMinor: AMOUNT,
  currency: 'COP',
  merchant: 'Juan Valdez',
  type: 'expense',
  category: null,
};

const category = { id: CATEGORY_ID, name: 'Restaurantes', icon: 'Utensils' };

/** The text of the nth message the bot sent back. */
function reply(n = 0): string {
  return String(vi.mocked(sendMessage).mock.calls[n]?.[1] ?? '');
}

function edited(n = 0): string {
  return String(vi.mocked(editMessageText).mock.calls[n]?.[2] ?? '');
}

describe('the Telegram client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sendMessage).mockResolvedValue({
      ok: true,
      result: { message_id: 99 },
    } as never);
    vi.mocked(answerCallbackQuery).mockResolvedValue({ ok: true, result: true });
    vi.mocked(editMessageText).mockResolvedValue({ ok: true, result: true });
    vi.mocked(editMessageReplyMarkup).mockResolvedValue({ ok: true, result: true });
    vi.mocked(resolveChat).mockResolvedValue(null);
    vi.mocked(resolvePromptContext).mockResolvedValue(null);
    vi.mocked(notifyIfUncategorized).mockResolvedValue({ sent: true, messageId: 99n });
    vi.mocked(shouldOfferCommandsTip).mockResolvedValue(false);
    vi.mocked(getDashboardData).mockResolvedValue({
      baseCurrency: 'COP',
      timezone: 'America/Bogota',
      totalBalanceMinor: 123_450_000n,
      monthlyTotals: { totalExpenseMinor: 84_730_000n, totalIncomeMinor: 0n, transactionCount: 5 },
      categoryBreakdown: [],
      recentDays: [],
      week: { today: '2026-09-23', days: [], todayExpenseMinor: 4_500_000n, weekExpenseMinor: 31_240_000n },
      uncategorizedCount: 0,
      currentMonthLabel: 'Septiembre 2026',
      lastCaptureAt: null,
      autoCaptureCount: 0,
    } as never);
    vi.mocked(getMonthViewData).mockResolvedValue({
      baseCurrency: 'COP',
      timezone: 'America/Bogota',
      monthlyTotals: { totalExpenseMinor: 100_000_000n, totalIncomeMinor: 250_000_000n, transactionCount: 20 },
      categoryBreakdown: [],
      days: [],
      monthLabel: 'Septiembre 2026',
      offset: 0,
      isCurrentMonth: true,
    } as never);
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

  describe('writing down a spend', () => {
    beforeEach(() => {
      vi.mocked(resolveChat).mockResolvedValue({ id: USER_ID, baseCurrency: 'COP' } as never);
    });

    it('points an unlinked chat at the app instead of recording anything', async () => {
      vi.mocked(resolveChat).mockResolvedValue(null);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(resolveChat).toHaveBeenCalledWith(BigInt(CHAT_ID));
      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain('no está conectado');
    });

    it('keys the write to the message id, so a redelivery is not a second coffee', async () => {
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: false,
        appliedCategory: null,
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(captureFromText).toHaveBeenCalledWith(
        USER_ID,
        expect.anything(),
        '12000 juan valdez',
        { source: 'telegram_text', externalId: `telegram:${CHAT_ID}:${MESSAGE_ID}` },
      );
    });

    it('answers with the category when the engine already knew it, and asks nothing', async () => {
      // Level 1. The whole point: the second time, there is nothing to tap.
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: true,
        appliedCategory: { name: 'Restaurantes', icon: 'Utensils' },
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply()).toContain('12.000');
      expect(reply()).toContain('Restaurantes');
      expect(notifyIfUncategorized).not.toHaveBeenCalled();
    });

    it('lets the question be the receipt when the engine had no answer', async () => {
      // Two messages for one coffee is how a useful bot becomes a muted one.
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: false,
        appliedCategory: null,
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(notifyIfUncategorized).toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('still confirms the spend when the question could not be delivered', async () => {
      // Rule 7: the money is stored. Silence here would read as a lost expense.
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: false,
        appliedCategory: null,
      } as never);
      vi.mocked(notifyIfUncategorized).mockResolvedValue({
        sent: false,
        reason: 'no_categories',
      });

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply()).toContain('12.000');
      expect(reply()).toContain('categorías');
    });

    it('tells the user about the commands exactly once, when the habit exists', async () => {
      // A second message per spend forever is how a useful bot gets muted.
      // The count of captures IS the state - there is no flag to get wrong.
      vi.mocked(shouldOfferCommandsTip).mockResolvedValue(true);
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: true,
        appliedCategory: { name: 'Restaurantes', icon: 'Utensils' },
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply(0)).toContain('Restaurantes');
      expect(reply(1)).toContain('/saldo');
      expect(reply(1)).toContain('Menu');
    });

    it('stays quiet about the commands on every other spend', async () => {
      vi.mocked(shouldOfferCommandsTip).mockResolvedValue(false);
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: true,
        appliedCategory: { name: 'Restaurantes', icon: 'Utensils' },
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('says nothing new about a redelivered message', async () => {
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: true,
        autoCategorized: false,
        appliedCategory: null,
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply()).toContain('ya lo tenía');
      expect(notifyIfUncategorized).not.toHaveBeenCalled();
    });

    it.each([
      ['no_amount', 'No encontré un monto'],
      ['no_merchant', 'no en qué fue'],
      ['not_positive', 'mayor que cero'],
    ])('explains a %s failure in words the user can act on', async (reason, expected) => {
      vi.mocked(captureFromText).mockResolvedValue({ ok: false, reason } as never);

      await handleTelegramUpdate(update('lo que sea'));

      expect(reply()).toContain(expected);
    });

    it.each(['no_amount', 'no_merchant', 'not_positive'])(
      'puts the whole format under a %s failure, both directions of money',
      async (reason) => {
        // The message that failed is the moment somebody will actually read
        // the instructions, and income is the half nobody discovers on their
        // own - there is no reason to guess that `+` means money coming in.
        vi.mocked(captureFromText).mockResolvedValue({ ok: false, reason } as never);

        await handleTelegramUpdate(update('lo que sea'));

        expect(reply()).toContain('GASTOS');
        expect(reply()).toContain('INGRESOS');
        expect(reply()).toContain('+2500000 salario');
      },
    );

    it('does not blame the format when the failure was ours', async () => {
      // 'unknown_account' is a bug on our side. Answering it with "here is how
      // to write an expense" tells the user they did something wrong.
      vi.mocked(captureFromText).mockResolvedValue({
        ok: false,
        reason: 'unknown_account',
      } as never);

      await handleTelegramUpdate(update('12000 juan valdez'));

      expect(reply()).not.toContain('GASTOS');
      expect(reply()).toContain('No pude guardarlo');
    });

    it.each([
      ['/saldo', '1.234.500'],
      ['/hoy', '45.000'],
    ])('answers %s from ONE dashboard read', async (command, expected) => {
      // The dashboard already computes the balance, today and the week
      // together. Asking for it twice would pay two Neon cold starts.
      await handleTelegramUpdate(update(command));

      expect(getDashboardData).toHaveBeenCalledTimes(1);
      expect(getMonthViewData).not.toHaveBeenCalled();
      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain(expected);
    });

    it('answers /mes from the month view, for the current month', async () => {
      await handleTelegramUpdate(update('/mes'));

      expect(getMonthViewData).toHaveBeenCalledWith(USER_ID, 0);
      expect(reply()).toContain('Septiembre 2026');
    });

    it('accepts the group form, /mes@thebot', async () => {
      await handleTelegramUpdate(update('/mes@reasonny_JP_bot'));

      expect(getMonthViewData).toHaveBeenCalled();
    });

    it('does not read a query as a merchant', async () => {
      await handleTelegramUpdate(update('/saldo'));

      expect(captureFromText).not.toHaveBeenCalled();
    });

    it('answers /ayuda with the format instead of trying to parse it', async () => {
      await handleTelegramUpdate(update('/ayuda'));

      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain('juan valdez');
    });

    it('does not read an unknown command as a merchant, and says what it CAN do', async () => {
      // /presupuesto is not built yet. The useful answer is the list of what
      // IS built, not a dead end.
      await handleTelegramUpdate(update('/presupuesto'));

      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain('No conozco');
      expect(reply()).toContain('GASTOS');
      expect(reply()).toContain('/saldo');
    });
  });

  describe('naming a new category by replying', () => {
    beforeEach(() => {
      vi.mocked(resolveChat).mockResolvedValue({ id: USER_ID, baseCurrency: 'COP' } as never);
    });

    it('creates the category and files the spend under it', async () => {
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_name',
        transaction,
      } as never);
      vi.mocked(createCategoryForPrompt).mockResolvedValue({
        ok: true,
        transaction,
        category,
        learned: true,
        firstAnswer: true,
      } as never);

      await handleTelegramUpdate(
        update('Mercado', { reply_to_message: { message_id: 55, chat: { id: CHAT_ID, type: 'private' }, date: 0 } }),
      );

      expect(resolvePromptContext).toHaveBeenCalledWith(USER_ID, 'telegram', BigInt(CHAT_ID), 55n);
      expect(createCategoryForPrompt).toHaveBeenCalledWith(USER_ID, expect.anything(), 'Mercado');
      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain('Restaurantes');
    });

    it('says so when the name is already taken, rather than silently doing nothing', async () => {
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_name',
        transaction,
      } as never);
      vi.mocked(createCategoryForPrompt).mockResolvedValue({ ok: false, reason: 'duplicate' } as never);

      await handleTelegramUpdate(
        update('Mercado', { reply_to_message: { message_id: 55, chat: { id: CHAT_ID, type: 'private' }, date: 0 } }),
      );

      expect(reply()).toContain('Ya tienes');
    });

    it('does not turn a command into a category, even when it is a reply', async () => {
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_name',
        transaction,
      } as never);

      await handleTelegramUpdate(
        update('/ayuda', { reply_to_message: { message_id: 55, chat: { id: CHAT_ID, type: 'private' }, date: 0 } }),
      );

      expect(createCategoryForPrompt).not.toHaveBeenCalled();
      expect(reply()).toContain('juan valdez');
    });

    it('reads a reply to the KEYBOARD message as a spend, not as a category name', async () => {
      // Answering the bot in a hurry by replying to the buttons is the normal
      // mistake. Without the kind check this created a category literally
      // called "12000 juan valdez" and recorded no transaction at all.
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_pick',
        transaction,
      } as never);
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: false,
        appliedCategory: null,
      } as never);

      await handleTelegramUpdate(
        update('12000 juan valdez', { reply_to_message: { message_id: 55, chat: { id: CHAT_ID, type: 'private' }, date: 0 } }),
      );

      expect(createCategoryForPrompt).not.toHaveBeenCalled();
      expect(captureFromText).toHaveBeenCalled();
    });

    it('reads a reply to anything else as a spend, not as a category name', async () => {
      // Quoting an old message while writing `12000 tienda` must still record it.
      vi.mocked(resolvePromptContext).mockResolvedValue(null);
      vi.mocked(captureFromText).mockResolvedValue({
        ok: true,
        transaction,
        isDuplicate: false,
        autoCategorized: false,
        appliedCategory: null,
      } as never);

      await handleTelegramUpdate(
        update('12000 tienda', { reply_to_message: { message_id: 55, chat: { id: CHAT_ID, type: 'private' }, date: 0 } }),
      );

      expect(createCategoryForPrompt).not.toHaveBeenCalled();
      expect(captureFromText).toHaveBeenCalled();
    });
  });

  describe('tapping a button', () => {
    beforeEach(() => {
      vi.mocked(resolveChat).mockResolvedValue({ id: USER_ID, baseCurrency: 'COP' } as never);
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_pick',
        transaction,
      } as never);
    });

    it('acks BEFORE it writes, and edits the message only after (spec §3.6)', async () => {
      vi.mocked(answerCategoryPrompt).mockResolvedValue({
        ok: true,
        transaction,
        category,
        learned: true,
        firstAnswer: true,
      } as never);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      const ack = vi.mocked(answerCallbackQuery).mock.invocationCallOrder[0] as number;
      const write = vi.mocked(answerCategoryPrompt).mock.invocationCallOrder[0] as number;
      const edit = vi.mocked(editMessageText).mock.invocationCallOrder[0] as number;

      expect(ack).toBeLessThan(write);
      expect(write).toBeLessThan(edit);
      // Neutral: the ack cannot claim a write that has not happened yet.
      expect(vi.mocked(answerCallbackQuery).mock.calls[0]?.[1]).toBeUndefined();
    });

    it('edits the message with the category and the promise that it learned', async () => {
      vi.mocked(answerCategoryPrompt).mockResolvedValue({
        ok: true,
        transaction,
        category,
        learned: true,
        firstAnswer: true,
      } as never);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      expect(edited()).toContain('Restaurantes');
      expect(edited()).toContain('Lo recordaré');
      // No keyboard on the edit: an answered question cannot be answered twice.
      expect(vi.mocked(editMessageText).mock.calls[0]?.[3]).toBeUndefined();
    });

    it('does not promise to remember a merchant it refused to learn', async () => {
      // "Transferencia enviada" is not a merchant; claiming otherwise is a lie
      // the user catches on the very next transfer.
      vi.mocked(answerCategoryPrompt).mockResolvedValue({
        ok: true,
        transaction,
        category,
        learned: false,
        firstAnswer: true,
      } as never);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      expect(edited()).not.toContain('Lo recordaré');
    });

    it('says the write failed instead of showing a success it did not get', async () => {
      vi.mocked(answerCategoryPrompt).mockResolvedValue({ ok: false, reason: 'not_found' } as never);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      expect(edited()).toContain('No se pudo guardar');
    });

    it('expands to the full list without redrawing the amount', async () => {
      vi.mocked(listPromptChoices).mockResolvedValue([
        { id: CATEGORY_ID, name: 'Restaurantes', icon: 'Utensils' },
      ] as never);

      await handleTelegramUpdate(tap('c:more'));

      expect(editMessageReplyMarkup).toHaveBeenCalled();
      expect(editMessageText).not.toHaveBeenCalled();
    });

    it('asks for a name with force_reply and records which spend it is for', async () => {
      await handleTelegramUpdate(tap('c:new'));

      expect(vi.mocked(sendMessage).mock.calls[0]?.[2]).toEqual({
        replyMarkup: { force_reply: true },
      });
      expect(trackFollowUpPrompt).toHaveBeenCalledWith(USER_ID, 'telegram', BigInt(CHAT_ID), 99n, 'tx-1');
    });

    it('keeps the keyboard when it cannot resolve the prompt', async () => {
      // One way to land here is a RACE, not a deletion: the prompt row is
      // inserted after sendMessage returns, so a tap during a Neon cold start
      // can beat the commit. Editing the message would strip the buttons and
      // leave the spend permanently uncategorisable from the chat.
      vi.mocked(resolvePromptContext).mockResolvedValue(null);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      expect(answerCategoryPrompt).not.toHaveBeenCalled();
      expect(editMessageText).not.toHaveBeenCalled();
      expect(reply()).toContain('Vuelve a tocar el botón');
    });

    it('does not overwrite a category the user already chose', async () => {
      // A redelivered callback, or a double tap. Re-showing the answer beats
      // silently replacing it with whatever the second tap said.
      vi.mocked(resolvePromptContext).mockResolvedValue({
        promptId: 'p1',
        kind: 'category_pick',
        transaction: { ...transaction, category },
      } as never);

      await handleTelegramUpdate(tap(`c:${CATEGORY_ID}`));

      expect(answerCategoryPrompt).not.toHaveBeenCalled();
      expect(edited()).toContain('Restaurantes');
    });

    it('still acks a payload it cannot read, so the button stops spinning', async () => {
      await handleTelegramUpdate(tap('nonsense'));

      expect(answerCallbackQuery).toHaveBeenCalledWith('cb-1');
      expect(answerCategoryPrompt).not.toHaveBeenCalled();
      expect(editMessageText).not.toHaveBeenCalled();
    });

    it('refuses a category id that is not a uuid before it reaches a query', async () => {
      await handleTelegramUpdate(tap("c:1' OR 1=1--"));

      expect(resolvePromptContext).not.toHaveBeenCalled();
    });
  });

  describe('what it ignores', () => {
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

    it('refuses an edited message instead of swallowing it as a duplicate', async () => {
      // The idempotency seed is the message id, so editing 1200 into 12000
      // collides with the original: ON CONFLICT DO NOTHING, "ya lo tenía
      // registrado", and the wrong amount left in the ledger.
      await handleTelegramUpdate({
        update_id: 1,
        edited_message: {
          message_id: MESSAGE_ID,
          chat: { id: CHAT_ID, type: 'private' },
          from: { id: 99, is_bot: false, language_code: 'es' },
          text: '12000 juan valdez',
          date: 0,
        },
      } as never);

      expect(captureFromText).not.toHaveBeenCalled();
      expect(reply()).toContain('mensajes editados');
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
