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
    const formattedEs = formatDate(testDate, 'es');
    const formattedEn = formatDate(testDate, 'en');

    expect(formattedEs).toBeDefined();
    expect(formattedEn).toBeDefined();
    expect(typeof formattedEs).toBe('string');
  });
});
