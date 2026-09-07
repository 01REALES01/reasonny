import { describe, expect, it } from 'vitest';

import robots from './robots';

describe('Robots.txt (Principle P8)', () => {
  it('blocks crawling of private and API paths', () => {
    const config = robots();

    expect(config.rules).toBeDefined();
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rule?.userAgent).toBe('*');
    expect(rule?.disallow).toContain('/api/');
    expect(rule?.disallow).toContain('/nuevo');
    expect(rule?.disallow).toContain('/dashboard');
    // Every authenticated route, not a sample: P8 says the product is private
    // and Google must not index any of it, so a new screen that forgets this
    // list has to fail here rather than in a search result.
    for (const path of ['/perfil', '/revisar', '/mes', '/movimiento', '/bienvenida']) {
      expect(rule?.disallow).toContain(path);
    }
    expect(config.sitemap).toBe('https://reasonny.app/sitemap.xml');
  });
});
