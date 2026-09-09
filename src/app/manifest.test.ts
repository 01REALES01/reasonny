import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('Web App Manifest (PWA — B8)', () => {
  it('returns valid manifest compliant with PWA standalone specifications', () => {
    const config = manifest();

    expect(config.name).toBe('Reasonny — Finanzas Personales con IA');
    expect(config.short_name).toBe('Reasonny');
    expect(config.display).toBe('standalone');
    expect(config.background_color).toBe('#09090b');
    expect(config.theme_color).toBe('#09090b');
    // The installed icon opens the app itself. Landing on '/' put the
    // marketing page in front of a signed-in user on every launch.
    expect(config.start_url).toBe('/dashboard');
    expect(config.scope).toBe('/');
    expect(config.icons).toBeDefined();
    expect(config.icons?.length).toBeGreaterThanOrEqual(2);

    const has512 = config.icons?.some((i) => i.sizes === '512x512');
    const has192 = config.icons?.some((i) => i.sizes === '192x192');
    expect(has512).toBe(true);
    expect(has192).toBe(true);
  });
});
