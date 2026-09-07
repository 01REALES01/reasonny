import { describe, expect, it } from 'vitest';

import { parseBankSms } from './index';

/**
 * The corpus.
 *
 * These reproduce the STRUCTURE of real Bancolombia and Banco de Bogotá
 * messages, and nothing else: amounts are altered, merchants are generic,
 * counterparty names are invented, phone numbers are not real numbers, and the
 * account digits are made up. The repository is treated as public and git
 * history cannot be cleaned afterwards, so a real amount or a real name
 * committed here is committed forever (CLAUDE.md, Datos sensibles).
 *
 * What must stay faithful is the punctuation, the word order and the date
 * formats - that is the whole point of the fixture, and it is also the part
 * that carries no personal data.
 */
const SMS = {
  bogotaCard:
    'Banco de Bogota: Tu compra por 45,000 fue aprobada con Tarjeta Débito 1111 el 26/08/26 20:18:00 en TIENDA GENERICA 170 BOGOTA ¿Dudas? Llama a la Servilinea ...',
  bogotaCardShortMerchant:
    'Banco de Bogota: Tu compra por 9,000 fue aprobada con Tarjeta Débito 1111 el 07/09/26 13:33:54 en CAFETERIA GENERICA MULTBOGOTA ¿Dudas? Llama a la Servilinea ...',
  bogotaDeclined:
    'Banco de Bogota: Tu compra por 45,000 fue rechazada con Tarjeta Débito 1111 el 26/08/26 20:18:00 en TIENDA GENERICA 170 BOGOTA ¿Dudas? Llama a la Servilinea ...',

  // Note the swapped labels: this template says "el <hora> a las <fecha>".
  bancolombiaIncomingPayment:
    'Bancolombia: Recibiste un pago por $500,000.00 de EMPRESA GENERICA SAS a tu cuenta AHORROS, el 12:24 a las 25/08/2026. ¿Tienes dudas? Encuentranos aqui:018000000000. Estamos cerca',
  bancolombiaTransferOut:
    'Bancolombia: NOMBRE, transferiste $12,300.00 a la llave 3000000000 desde tu cuenta *9999 a persona ejemplo el 07/09/26 a las 13:15. Con Bre-b es de una y gratis. Dudas al 018000000000',
  bancolombiaIncomingTransfer:
    'Bancolombia: Recibiste una transferencia por $180,000 de OTRA PERSONA en tu cuenta **9999, el 24/08/2026 a las 05:54. Si tienes dudas, hablemos: 018000000000. Siempre a tu lado.',
  bancolombiaQr:
    'Bancolombia: NOMBRE APELLIDO EJEMPLO pagaste $7,500.00 por codigo QR desde tu cuenta *9999 a la llave 3000000001 el 21/08/2026 a las 17:09. Con codigo QR es facil y de una. Dudas al 018000000000',
} as const;

function ok(text: string) {
  const result = parseBankSms(text);
  if (!result.ok) {
    throw new Error(`expected a parse, got ${result.reason}`);
  }
  return result.transaction;
}

describe('Bank SMS parsers', () => {
  describe('Banco de Bogotá', () => {
    it('reads a card purchase', () => {
      const tx = ok(SMS.bogotaCard);

      expect(tx.bank).toBe('banco_bogota');
      expect(tx.type).toBe('expense');
      // COP has scale 100 even though the peso has no practical cents.
      expect(tx.amountMinor).toBe(4500000n);
      expect(tx.merchant).toBe('TIENDA GENERICA 170 BOGOTA');
      expect(tx.accountMask).toBe('1111');
    });

    it('reads the merchant without the trailing marketing sentence', () => {
      expect(ok(SMS.bogotaCardShortMerchant).merchant).toBe(
        'CAFETERIA GENERICA MULTBOGOTA',
      );
    });

    /**
     * The bank sends the same sentence for an approved and a rejected purchase
     * and only the verb changes. Recording a decline as a spend would inflate
     * the month's total with money that never left the account.
     */
    it('refuses to record a rejected purchase', () => {
      const result = parseBankSms(SMS.bogotaDeclined);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe('declined');
    });
  });

  describe('Bancolombia', () => {
    it('reads an outgoing Bre-b transfer and keeps the recipient name', () => {
      const tx = ok(SMS.bancolombiaTransferOut);

      expect(tx.type).toBe('expense');
      expect(tx.amountMinor).toBe(1230000n);
      expect(tx.merchant).toBe('persona ejemplo');
      expect(tx.accountMask).toBe('9999');
    });

    it('reads an incoming transfer as income, not as a spend', () => {
      const tx = ok(SMS.bancolombiaIncomingTransfer);

      expect(tx.type).toBe('income');
      expect(tx.amountMinor).toBe(18000000n);
      expect(tx.merchant).toBe('OTRA PERSONA');
    });

    it('masks the key when a QR payment carries no name', () => {
      const tx = ok(SMS.bancolombiaQr);

      expect(tx.type).toBe('expense');
      expect(tx.amountMinor).toBe(750000n);
      // The full number is somebody's phone and is not needed to recognise the
      // payment later.
      expect(tx.merchant).toBe('Llave ••0001');
      expect(tx.merchant).not.toContain('3000000001');
    });

    it('parses millions without losing a digit to the grouping commas', () => {
      expect(ok(SMS.bancolombiaIncomingPayment).amountMinor).toBe(50000000n);
    });

    /**
     * This template reads "el 12:24 a las 25/08/2026" - the time where the date
     * belongs and the date where the time belongs - while the same bank's other
     * templates say the opposite. Reading the parts positionally builds an
     * invalid date and does it silently, which is why each part is found by its
     * own shape instead.
     */
    it('survives the template that swaps the date and the time labels', () => {
      const tx = ok(SMS.bancolombiaIncomingPayment);

      // 2026-08-25 12:24 in Bogotá (UTC-5) is 17:24 UTC.
      expect(tx.transactionDate.toISOString()).toBe('2026-08-25T17:24:00.000Z');
    });

    it('reads a two-digit year as this century', () => {
      // 07/09/26 13:15 Bogotá -> 18:15 UTC
      expect(ok(SMS.bancolombiaTransferOut).transactionDate.toISOString()).toBe(
        '2026-09-07T18:15:00.000Z',
      );
    });

    /**
     * An evening transaction is the case that breaks a parser which treats the
     * wall clock as UTC: 20:18 on the 26th in Bogotá is 01:18 on the 27th UTC,
     * so the spend would be filed on the wrong day and, at a month boundary,
     * in the wrong month.
     */
    it('anchors the wall clock to Bogotá, not to UTC', () => {
      expect(ok(SMS.bogotaCard).transactionDate.toISOString()).toBe(
        '2026-08-27T01:18:00.000Z',
      );
    });
  });

  describe('Failure is explicit, never a guess', () => {
    it('reports an unknown bank rather than attempting a parse', () => {
      const result = parseBankSms('Su codigo de verificacion es 998877');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe('unknown_bank');
    });

    it('reports a changed format instead of inventing an amount', () => {
      const result = parseBankSms(
        'Bancolombia: transferiste a alguien, algun dia, alguna cantidad.',
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe('unrecognized_format');
      expect(result.ok === false && result.bank).toBe('bancolombia');
    });

    /**
     * A message carrying both an income and an expense verb means the template
     * moved under us. Choosing one would put the amount on the wrong side of
     * the ledger, which corrupts the balance, the month total and the category
     * breakdown at once.
     */
    it('refuses a message whose direction is ambiguous', () => {
      const result = parseBankSms(
        'Bancolombia: Recibiste y transferiste $10,000.00 el 01/01/2026 a las 10:00',
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe('unrecognized_format');
    });

    it('rejects an impossible calendar day instead of rolling it forward', () => {
      const result = parseBankSms(
        'Banco de Bogota: Tu compra por 45,000 fue aprobada con Tarjeta Débito 1111 el 31/02/26 10:00:00 en TIENDA GENERICA ¿Dudas?',
      );

      expect(result.ok).toBe(false);
    });

    it('never throws, whatever it is handed', () => {
      for (const junk of ['', '   ', '$$$', '////', 'Bancolombia:']) {
        expect(() => parseBankSms(junk)).not.toThrow();
        expect(parseBankSms(junk).ok).toBe(false);
      }
    });
  });
});
