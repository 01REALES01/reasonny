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
    expect(rule?.disallow).toContain('/perfil');
    expect(config.sitemap).toBe('https://reasonny.app/sitemap.xml');
  });
});
