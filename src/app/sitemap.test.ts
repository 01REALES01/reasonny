import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('Sitemap (Principle P8)', () => {
  it('contains only public canonical routes', () => {
    const entries = sitemap();

    expect(entries.length).toBeGreaterThanOrEqual(2);
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith('/'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/sign-in'))).toBe(true);
    // Ley 1581: the policy is public before anyone signs up.
    expect(urls.some((u) => u.endsWith('/privacidad'))).toBe(true);
    expect(urls.some((u) => u.includes('/api/'))).toBe(false);
    expect(urls.some((u) => u.includes('/nuevo'))).toBe(false);
  });
});
