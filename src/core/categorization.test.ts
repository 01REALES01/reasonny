import { describe, expect, it } from 'vitest';

import { isLearnableMerchantKey, normalizeMerchant } from './categorization';

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

describe('isLearnableMerchantKey', () => {
  it.each([
    ['a real shop', 'juan valdez'],
    ['a shop whose name contains a number', 'tienda 24'],
    ['a payment processor prefix', 'uber*rides'],
  ])('learns from %s', (_why, key) => {
    expect(isLearnableMerchantKey(key)).toBe(true);
  });

  it.each([
    ['the placeholder for an unnamed transfer out', 'Transferencia enviada'],
    // The two directions are written by different branches of the parser and
    // rules are keyed by direction, so each one has to be listed.
    ['the placeholder for an unnamed transfer in', 'Transferencia recibida'],
    ['the placeholder for a cash withdrawal', 'Retiro en cajero'],
    ['a masked account number', 'Cuenta ••9149'],
    ['a masked QR key', 'Llave ••0001'],
    ['no key at all', ''],
  ])('refuses %s', (_why, merchant) => {
    // These are what the SMS parser writes when it cannot find a counterparty.
    // Learning from one would file EVERY future unnamed transfer under whatever
    // category that first one got, silently and forever.
    expect(isLearnableMerchantKey(normalizeMerchant(merchant))).toBe(false);
  });
});
});