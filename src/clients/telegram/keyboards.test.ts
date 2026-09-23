import { describe, expect, it } from 'vitest';

import type { CategoryRow } from '@/core/repositories/category.repository';

import { fullKeyboard, parseCallbackData, suggestedKeyboard } from './keyboards';

const UUID = '33333333-3333-4333-8333-333333333333';

function category(id: string, name: string, icon = 'Utensils'): CategoryRow {
  return { id, name, icon, color: '#F59E0B', type: 'expense' } as CategoryRow;
}

describe('the category keyboard', () => {
  describe('reading a tapped button', () => {
    it('reads a category id', () => {
      expect(parseCallbackData(`c:${UUID}`)).toEqual({ kind: 'category', categoryId: UUID });
    });

    it.each([['c:more', 'more'], ['c:new', 'new']])('reads %s', (data, kind) => {
      expect(parseCallbackData(data)).toEqual({ kind });
    });

    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['another namespace', `x:${UUID}`],
      ['a bare uuid', UUID],
      ['not a uuid', 'c:not-a-uuid'],
      ['sql wearing a uuid coat', "c:1' OR 1=1--"],
      ['a uuid with something appended', `c:${UUID}extra`],
    ])('refuses %s', (_label, data) => {
      expect(parseCallbackData(data)).toBeNull();
    });
  });

  describe('the 64-byte budget', () => {
    // Telegram rejects the WHOLE message when any callback_data is longer, so
    // the spend would arrive with no way to categorise it at all.
    const LIMIT = 64;

    it('keeps every payload inside it, for both keyboards', () => {
      const rows = [
        ...suggestedKeyboard([category(UUID, 'Restaurantes y Café')], 'es').inline_keyboard,
        ...fullKeyboard([category(UUID, 'Restaurantes y Café')], 'es').inline_keyboard,
      ];

      for (const row of rows) {
        for (const button of row) {
          expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(LIMIT);
        }
      }
    });
  });

  describe('layout', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      category(`3333333${i}-3333-4333-8333-333333333333`, `Cat ${i}`),
    );

    it('puts two categories per row, so a name still fits on a phone', () => {
      const rows = suggestedKeyboard(many.slice(0, 3), 'es').inline_keyboard;

      expect(rows[0]).toHaveLength(2);
      expect(rows[1]).toHaveLength(1);
    });

    it('offers the way out of the short list, and the way to a new category', () => {
      const rows = suggestedKeyboard(many.slice(0, 3), 'es').inline_keyboard;
      const last = rows[rows.length - 1] ?? [];

      expect(last.map((b) => b.callback_data)).toEqual(['c:more', 'c:new']);
    });

    it('drops "more" once the list IS everything', () => {
      const rows = fullKeyboard(many, 'es').inline_keyboard;
      const payloads = rows.flat().map((b) => b.callback_data);

      expect(payloads).not.toContain('c:more');
      expect(payloads).toContain('c:new');
    });

    it('labels a button with the emoji and the name', () => {
      const [row] = suggestedKeyboard([category(UUID, 'Restaurantes')], 'es').inline_keyboard;

      expect(row?.[0]?.text).toBe('🍽 Restaurantes');
    });
  });
});
