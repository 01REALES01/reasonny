import { describe, expect, it } from 'vitest';

import { DEFAULT_SEED_CATEGORIES } from '@/core/repositories/category.repository';

import { categoryLabel, emojiForIcon, FALLBACK_EMOJI } from './category-emoji';

describe('drawing a category in a chat', () => {
  it('has an emoji for every icon the seed catalogue ships', () => {
    // A seeded category showing a bullet would mean the default experience is
    // the degraded one.
    for (const seed of DEFAULT_SEED_CATEGORIES) {
      expect(emojiForIcon(seed.icon), seed.icon).not.toBe(FALLBACK_EMOJI);
    }
  });

  it('falls back rather than throwing on an icon it does not know', () => {
    // The picker can gain icons; a missing glyph must never be the reason a
    // spend cannot be categorised.
    expect(emojiForIcon('SomethingLucideAddedLastWeek')).toBe(FALLBACK_EMOJI);
    expect(emojiForIcon(null)).toBe(FALLBACK_EMOJI);
    expect(emojiForIcon(undefined)).toBe(FALLBACK_EMOJI);
    expect(emojiForIcon('')).toBe(FALLBACK_EMOJI);
  });

  it('uses no ZWJ sequences, which render as tofu on some Telegram clients', () => {
    for (const seed of DEFAULT_SEED_CATEGORIES) {
      expect(emojiForIcon(seed.icon)).not.toContain('‍');
    }
  });

  describe('the label', () => {
    it('reads as emoji then name', () => {
      expect(categoryLabel('Restaurantes', 'Utensils')).toBe('🍽 Restaurantes');
    });

    it('truncates a name long enough to wrap the button', () => {
      const label = categoryLabel('Una categoría con un nombre larguísimo', 'Tag');

      expect(label).toContain('…');
      expect(label.length).toBeLessThan(30);
    });

    it('leaves a name that fits alone', () => {
      expect(categoryLabel('Supermercado', 'ShoppingCart')).toBe('🛒 Supermercado');
    });
  });
});
