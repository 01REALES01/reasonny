import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/category.repository', () => ({
  listCategories: vi.fn(),
  listMostUsedCategories: vi.fn(),
}));

vi.mock('@/core/repositories/notification-prompt.repository', () => ({
  findPromptByMessage: vi.fn(),
  markPromptAnswered: vi.fn(),
  recordPrompt: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  getEnrichedTransaction: vi.fn(),
}));

vi.mock('@/core/services/categorization.service', () => ({
  categorizeTransaction: vi.fn(),
}));

vi.mock('@/core/services/category.service', () => ({
  createUserCategory: vi.fn(),
}));

import {
  listCategories,
  listMostUsedCategories,
} from '@/core/repositories/category.repository';
import {
  findPromptByMessage,
  markPromptAnswered,
  recordPrompt,
} from '@/core/repositories/notification-prompt.repository';
import { getEnrichedTransaction } from '@/core/repositories/transaction.repository';
import { createUserCategory } from '@/core/services/category.service';
import { categorizeTransaction } from '@/core/services/categorization.service';
import { toUserId } from '@/core/types';

import {
  answerCategoryPrompt,
  createCategoryForPrompt,
  listPromptChoices,
  notifyIfUncategorized,
  resolvePromptContext,
  trackFollowUpPrompt,
} from './notification.service';

const userId = toUserId('11111111-1111-4111-8111-111111111111');
const CHAT = 4_242_424_242n;
const MESSAGE = 7n;
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

const category = { id: CATEGORY_ID, name: 'Restaurantes', icon: 'Utensils' } as never;

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    amountMinor: 1_200_000n,
    currency: 'COP',
    merchant: 'Juan Valdez',
    type: 'expense',
    categoryId: null,
    category: null,
    ...overrides,
  } as never;
}

function profile(overrides: Record<string, unknown> = {}) {
  return { id: userId, telegramChatId: CHAT, baseCurrency: 'COP', ...overrides } as never;
}

/** An adapter that always delivers, and remembers what it was asked to send. */
function adapter(messageId: bigint | null = 99n) {
  return {
    provider: 'telegram' as const,
    deliverCategoryPrompt: vi.fn().mockResolvedValue(messageId === null ? null : { messageId }),
  };
}

describe('asking which category a spend belongs to', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listMostUsedCategories).mockResolvedValue([category]);
  });

  it('asks nothing when the rule engine already answered', async () => {
    // Level 1 is silence. A prompt here is the treadmill level 2 exists to end.
    const sent = adapter();

    const result = await notifyIfUncategorized(
      userId,
      profile(),
      transaction({ categoryId: CATEGORY_ID }),
      sent,
    );

    expect(result).toEqual({ sent: false, reason: 'already_categorized' });
    expect(sent.deliverCategoryPrompt).not.toHaveBeenCalled();
  });

  it('asks nothing when no chat is bound to the account', async () => {
    const sent = adapter();

    const result = await notifyIfUncategorized(
      userId,
      profile({ telegramChatId: null }),
      transaction(),
      sent,
    );

    expect(result).toEqual({ sent: false, reason: 'not_linked' });
    expect(sent.deliverCategoryPrompt).not.toHaveBeenCalled();
  });

  it('refuses to send a question with no answers under it', async () => {
    // Checked here, not in the adapter, so every provider inherits the refusal.
    vi.mocked(listMostUsedCategories).mockResolvedValue([]);
    const sent = adapter();

    const result = await notifyIfUncategorized(userId, profile(), transaction(), sent);

    expect(result).toEqual({ sent: false, reason: 'no_categories' });
    expect(sent.deliverCategoryPrompt).not.toHaveBeenCalled();
  });

  it('offers income categories for income, and expense ones for a transfer', async () => {
    const sent = adapter();

    await notifyIfUncategorized(userId, profile(), transaction({ type: 'income' }), sent);
    expect(listMostUsedCategories).toHaveBeenLastCalledWith(userId, 'income', 3);

    // A transfer has no direction to file; an empty keyboard would be worse.
    await notifyIfUncategorized(userId, profile(), transaction({ type: 'transfer' }), sent);
    expect(listMostUsedCategories).toHaveBeenLastCalledWith(userId, 'expense', 3);
  });

  it('records the message it sent, so the tap can be traced back to the spend', async () => {
    const sent = adapter(555n);

    const result = await notifyIfUncategorized(userId, profile(), transaction(), sent);

    expect(result).toEqual({ sent: true, messageId: 555n });
    expect(recordPrompt).toHaveBeenCalledWith(userId, {
      transactionId: 'tx-1',
      provider: 'telegram',
      kind: 'category_pick',
      chatId: CHAT,
      externalMessageId: 555n,
    });
  });

  it('records nothing when the question never went out', async () => {
    // A prompt row for a message that does not exist would resolve a tap that
    // can never happen, and would count as a question asked in the metrics.
    const sent = adapter(null);

    const result = await notifyIfUncategorized(userId, profile(), transaction(), sent);

    expect(result).toEqual({ sent: false, reason: 'delivery_failed' });
    expect(recordPrompt).not.toHaveBeenCalled();
  });
});

describe('resolving what a tapped button was attached to', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('goes message -> prompt -> transaction, scoped by user at every step', async () => {
    vi.mocked(findPromptByMessage).mockResolvedValue({
      id: 'p1',
      transactionId: 'tx-1',
      kind: 'category_pick',
    } as never);
    vi.mocked(getEnrichedTransaction).mockResolvedValue(transaction());

    const context = await resolvePromptContext(userId, 'telegram', CHAT, MESSAGE);

    expect(findPromptByMessage).toHaveBeenCalledWith(userId, 'telegram', CHAT, MESSAGE);
    expect(getEnrichedTransaction).toHaveBeenCalledWith(userId, 'tx-1');
    expect(context?.promptId).toBe('p1');
    // The client branches on this: a reply to the keyboard message is not a
    // category name.
    expect(context?.kind).toBe('category_pick');
  });

  it('answers null for a message it never sent', async () => {
    vi.mocked(findPromptByMessage).mockResolvedValue(null);

    expect(await resolvePromptContext(userId, 'telegram', CHAT, MESSAGE)).toBeNull();
    expect(getEnrichedTransaction).not.toHaveBeenCalled();
  });

  it('answers null when the spend behind the prompt is gone', async () => {
    vi.mocked(findPromptByMessage).mockResolvedValue({
      id: 'p1',
      transactionId: 'tx-1',
      kind: 'category_pick',
    } as never);
    vi.mocked(getEnrichedTransaction).mockResolvedValue(null);

    expect(await resolvePromptContext(userId, 'telegram', CHAT, MESSAGE)).toBeNull();
  });

  it('offers the whole list of the right direction when asked to expand', async () => {
    vi.mocked(listCategories).mockResolvedValue([category]);

    await listPromptChoices(userId, {
      promptId: 'p1',
      kind: 'category_pick',
      transaction: transaction({ type: 'income' }),
    });

    expect(listCategories).toHaveBeenCalledWith(userId, { type: 'income' });
  });
});

describe('answering the prompt', () => {
  const context = { promptId: 'p1', kind: 'category_pick' as const, transaction: transaction() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(categorizeTransaction).mockResolvedValue({
      ok: true,
      transaction: transaction({ categoryId: CATEGORY_ID }),
      category,
      learned: true,
    });
    vi.mocked(markPromptAnswered).mockResolvedValue(true);
  });

  it('writes BEFORE it marks the prompt answered', async () => {
    // If the process dies between them, Telegram redelivers and the category
    // is re-applied to the same value. Marking first would leave a prompt
    // recorded as answered with nothing behind it.
    await answerCategoryPrompt(userId, context, CATEGORY_ID);

    const wrote = vi.mocked(categorizeTransaction).mock.invocationCallOrder[0] as number;
    const marked = vi.mocked(markPromptAnswered).mock.invocationCallOrder[0] as number;

    expect(wrote).toBeLessThan(marked);
  });

  it('reports the second delivery of the same tap as not the first answer', async () => {
    // The category is still applied - idempotently - but nothing is counted
    // twice in the level 2 gesture metric.
    vi.mocked(markPromptAnswered).mockResolvedValue(false);

    const result = await answerCategoryPrompt(userId, context, CATEGORY_ID);

    expect(result).toMatchObject({ ok: true, firstAnswer: false });
  });

  it('does not mark a prompt answered when the write was refused', async () => {
    vi.mocked(categorizeTransaction).mockResolvedValue({ ok: false, reason: 'not_found' });

    const result = await answerCategoryPrompt(userId, context, CATEGORY_ID);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(markPromptAnswered).not.toHaveBeenCalled();
  });

  describe('a category that did not exist yet', () => {
    it('creates it in the spend\'s own direction, then applies it', async () => {
      vi.mocked(createUserCategory).mockResolvedValue({ ok: true, category });

      const result = await createCategoryForPrompt(
        userId,
        { promptId: 'p1', kind: 'category_name' as const, transaction: transaction({ type: 'income' }) },
        'Freelance',
      );

      expect(createUserCategory).toHaveBeenCalledWith(userId, {
        name: 'Freelance',
        type: 'income',
      });
      expect(categorizeTransaction).toHaveBeenCalledWith(userId, 'tx-1', CATEGORY_ID);
      expect(result.ok).toBe(true);
    });

    it('applies nothing when the category could not be created', async () => {
      vi.mocked(createUserCategory).mockResolvedValue({ ok: false, reason: 'duplicate' });

      const result = await createCategoryForPrompt(userId, context, 'Restaurantes');

      expect(result).toEqual({ ok: false, reason: 'duplicate' });
      expect(categorizeTransaction).not.toHaveBeenCalled();
    });
  });

  it('marks the force_reply as a question about a NAME, not about a category', async () => {
    await trackFollowUpPrompt(userId, 'telegram', CHAT, 99n, 'tx-1');

    expect(recordPrompt).toHaveBeenCalledWith(userId, {
      transactionId: 'tx-1',
      provider: 'telegram',
      kind: 'category_name',
      chatId: CHAT,
      externalMessageId: 99n,
    });
  });

  it('swallows a failure to track a follow-up, because the spend is already safe', async () => {
    vi.mocked(recordPrompt).mockRejectedValue(new Error('neon is asleep'));

    await expect(
      trackFollowUpPrompt(userId, 'telegram', CHAT, 99n, 'tx-1'),
    ).resolves.toBeUndefined();
  });
});
