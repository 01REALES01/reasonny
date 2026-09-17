import { describe, expect, it } from 'vitest';

import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';

import {
  CSV_HEADER_LINE,
  formatTransactionToCsvRow,
  sanitizeCsvField,
} from './csv-export.service';

describe('CSV Export Service', () => {
  describe('sanitizeCsvField', () => {
    it('escapes fields containing commas or quotes (RFC 4180)', () => {
      expect(sanitizeCsvField('Café, Juan Valdez')).toBe('"Café, Juan Valdez"');
      expect(sanitizeCsvField('Restaurante "El Buen Sabor"')).toBe(
        '"Restaurante ""El Buen Sabor"""',
      );
    });

    it('neutralizes formula injection characters', () => {
      expect(sanitizeCsvField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvField('+12345')).toBe("'+12345");
      expect(sanitizeCsvField('@dangerous')).toBe("'@dangerous");
      expect(sanitizeCsvField('-cmd|')).toBe("'-cmd|");
    });

    it('handles empty and null values gracefully', () => {
      expect(sanitizeCsvField(null)).toBe('');
      expect(sanitizeCsvField(undefined)).toBe('');
      expect(sanitizeCsvField('')).toBe('');
    });
  });

  // The minor-units-to-decimal cases moved to money.test.ts along with the
  // function itself: the export now calls core/money's toDecimalString instead
  // of keeping a second copy of the same arithmetic.

  describe('formatTransactionToCsvRow & CSV_HEADER_LINE', () => {
    it('generates correct CSV header', () => {
      expect(CSV_HEADER_LINE).toContain('id,date,merchant,amount,currency,type,category,account,status,source,note');
      expect(CSV_HEADER_LINE.endsWith('\r\n')).toBe(true);
    });

    it('formats enriched transaction row correctly', () => {
      const mockTx: EnrichedTransactionRow = {
        id: 'tx-12345',
        amountMinor: 4500000n,
        currency: 'COP',
        type: 'expense',
        status: 'confirmed',
        merchant: 'Juan Valdez, Unicentro',
        note: 'Café matutino',
        transactionDate: new Date('2026-08-27T10:30:00Z'),
        categorizedBy: 'rule_engine',
        category: {
          id: 'cat-1',
          name: 'Restaurantes y Café',
          icon: 'Utensils',
          color: '#F59E0B',
        },
        account: {
          id: 'acc-1',
          name: 'Bancolombia Débito',
          currency: 'COP',
        },
        // Present on the row, absent from the export on purpose: a CSV with
        // coordinates in it is a movement history, and it leaves the app.
        location: null,
      };

      const row = formatTransactionToCsvRow(mockTx);
      expect(row).toContain('tx-12345');
      expect(row).toContain('2026-08-27');
      expect(row).toContain('"Juan Valdez, Unicentro"');
      expect(row).toContain('45000.00');
      expect(row).toContain('COP');
      expect(row).toContain('Restaurantes y Café');
      expect(row).toContain('Bancolombia Débito');
      expect(row).toContain('Café matutino');
    });
  });
});
