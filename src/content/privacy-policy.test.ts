import { describe, expect, it } from 'vitest';

import { PRIVACY_POLICY } from './privacy-policy';

describe('privacy policy text', () => {
  it('says the same things in both languages', () => {
    const ids = (locale: 'es' | 'en') => PRIVACY_POLICY[locale].sections.map((s) => s.id);
    expect(ids('en')).toEqual(ids('es'));

    // A list in one language and prose in the other means a sentence was lost
    // in translation; same number of items, section by section.
    PRIVACY_POLICY.es.sections.forEach((section, i) => {
      const en = PRIVACY_POLICY.en.sections[i]!;
      expect(en.items?.length ?? 0).toBe(section.items?.length ?? 0);
      expect(en.paragraphs.length).toBe(section.paragraphs.length);
    });
  });

  it('names every processor the plan declares, in both languages', () => {
    for (const locale of ['es', 'en'] as const) {
      const text = JSON.stringify(PRIVACY_POLICY[locale]);
      for (const processor of ['Neon', 'Vercel', 'Google', 'Telegram', 'Cloudflare', 'Meta']) {
        expect(text).toContain(processor);
      }
    }
  });
});
