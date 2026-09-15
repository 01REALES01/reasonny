import { describe, expect, it } from 'vitest';

import { normalizeMerchant } from './categorization';

describe('normalizeMerchant', () => {
  it('sees one merchant where two sources wrote it differently', () => {
    // The left side is what a person types into /nuevo. The right side is what
    // the bank puts in an SMS. They are the same shop.
    expect(normalizeMerchant('  Café  Juan Valdez ')).toBe(
      normalizeMerchant('CAFE JUAN VALDEZ'),
    );
  });

  it.each([
    ['ÉXITO POBLADO', 'exito poblado'],
    ['Panadería Ñoño', 'panaderia nono'],
    ['  DOBLE   ESPACIO  ', 'doble espacio'],
    ['MAYÚSCULAS', 'mayusculas'],
  ])('normalises %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });

  /**
   * The stored column and the lookup key both come out of this function, and a
   * stored key gets normalised again on any path that re-reads it. If a second
   * pass changed the value, a merchant would stop matching itself.
   */
  it('is idempotent', () => {
    for (const raw of ['Café Juan Valdez', 'ÉXITO  POBLADO', '  ', 'a', 'ÑÁÉÍÓÚ']) {
      const once = normalizeMerchant(raw);
      expect(normalizeMerchant(once)).toBe(once);
    }
  });

  /**
   * NFD decomposition splits one accented character into two, so a naive
   * implementation can make the string longer before it strips the marks. If
   * that happened past 255 the write path and the read path could truncate at
   * different points and produce two keys for one merchant.
   */
  it('never returns more characters than it was given', () => {
    for (const raw of ['ÁÉÍÓÚÑ', 'x'.repeat(300), 'Café'.repeat(80)]) {
      expect(normalizeMerchant(raw).length).toBeLessThanOrEqual(raw.length);
    }
  });

  it('caps at the column width so a long name cannot be cut differently later', () => {
    expect(normalizeMerchant('A'.repeat(400))).toHaveLength(255);
  });

  it.each(['', '   ', '\n\t '])('answers empty for %j, which callers treat as no key', (raw) => {
    expect(normalizeMerchant(raw)).toBe('');
  });

  /**
   * Exact match is the doctrine. Branch numbers stay in, because deciding which
   * part of a name identifies the shop is a guess, and a wrong category is
   * worse than none.
   */
  it('keeps branch numbers instead of guessing they are noise', () => {
    expect(normalizeMerchant('TIENDA GENERICA 170 BOGOTA')).not.toBe(
      normalizeMerchant('TIENDA GENERICA 45 MEDELLIN'),
    );
  });
});
