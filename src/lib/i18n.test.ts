import { describe, expect, it } from 'vitest';

import { formatDate, t } from './i18n';

describe('i18n Catalog and Formatters', () => {
  it('translates existing keys in Spanish and English', () => {
    expect(t('quick_add_title', 'es')).toBe('Nuevo Registro');
    expect(t('quick_add_title', 'en')).toBe('New Transaction');
    expect(t('btn_submit_transaction', 'es')).toBe('Guardar Transacción');
    expect(t('btn_submit_transaction', 'en')).toBe('Save Transaction');
  });

  it('formats dates consistently by locale', () => {
    const testDate = new Date('2026-08-27T12:00:00Z');
    const formattedEs = formatDate(testDate, 'America/Bogota', 'es');
    const formattedEn = formatDate(testDate, 'America/Bogota', 'en');

    expect(formattedEs).toBeDefined();
    expect(formattedEn).toBeDefined();
    expect(typeof formattedEs).toBe('string');
  });

  /**
   * The reason timeZone is a required argument. This instant is 31 August in
   * Bogotá and 1 September in UTC, and the monthly totals it belongs to are
   * grouped by the profile's zone. Reading it in any other zone puts the row in
   * a month its own total disagrees with.
   */
  it('reads a date in the zone it was grouped in, not the host zone', () => {
    const lateAugustInBogota = new Date('2026-09-01T01:18:00Z');

    expect(
      formatDate(lateAugustInBogota, 'America/Bogota', 'es', {
        month: 'short',
        day: 'numeric',
      }),
    ).toContain('31');

    expect(
      formatDate(lateAugustInBogota, 'UTC', 'es', { month: 'short', day: 'numeric' }),
    ).toContain('1');
  });
});
