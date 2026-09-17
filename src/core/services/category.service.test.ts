import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/category.repository', () => ({
  createCategory: vi.fn(),
}));

import { createCategory } from '@/core/repositories/category.repository';
import { toUserId } from '@/core/types';

import { createUserCategory } from './category.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('createUserCategory', () => {
  const userId = toUserId(USER_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createCategory).mockResolvedValue({ id: 'cat-1' } as never);
  });

  it('fills in the defaults a bare name does not carry', async () => {
    // What the Telegram bot will send: a name and nothing else. The icon and
    // colour are refined later in the PWA, where the drawer lives.
    const result = await createUserCategory(userId, { name: 'Peluquería' });

    expect(result).toEqual({ ok: true, category: { id: 'cat-1' } });
    expect(createCategory).toHaveBeenCalledWith(userId, {
      name: 'Peluquería',
      type: 'expense',
      icon: 'Tag',
      color: '#e4cca6',
    });
  });

  it('trims the name before storing it', async () => {
    await createUserCategory(userId, { name: '  Mercado  ' });

    expect(vi.mocked(createCategory).mock.calls[0]?.[1].name).toBe('Mercado');
  });

  it('rejects a blank name without touching the database', async () => {
    const result = await createUserCategory(userId, { name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'El nombre es obligatorio' });
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('rejects a CSS expression where a hex belongs', async () => {
    // The whole reason this validation exists: `var(--cat-color-rose)` is 24
    // characters against a varchar(20), so it could only ever have reached
    // Postgres as an error the user could do nothing with.
    const result = await createUserCategory(userId, {
      name: 'Café',
      color: 'var(--cat-color-rose)',
    });

    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('names the duplicate rather than leaking the driver error', async () => {
    vi.mocked(createCategory).mockRejectedValue(
      new Error('duplicate key value violates unique constraint "uq_categories_name"'),
    );

    const result = await createUserCategory(userId, { name: 'Transporte' });

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('reports any other write failure as a plain failure', async () => {
    vi.mocked(createCategory).mockRejectedValue(new Error('connection terminated'));

    const result = await createUserCategory(userId, { name: 'Transporte' });

    expect(result).toEqual({ ok: false, reason: 'failed' });
  });
});
