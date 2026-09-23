import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';

import { parseQuickEntry } from './quick-entry';

/** Every case is read in COP, the currency the profile actually uses. */
function parse(input: string) {
  return parseQuickEntry(input, 'COP');
}

function entry(input: string) {
  const result = parse(input);
  if (!result.ok) {
    throw new Error(`expected "${input}" to parse, got ${result.reason}`);
  }
  return result.entry;
}

describe('parseQuickEntry', () => {
  describe('what it reads', () => {
    it('reads the shape the whole feature exists for', () => {
      expect(entry('12000 juan valdez')).toEqual({
        amountMinor: 1_200_000n,
        type: 'expense',
        merchant: 'juan valdez',
        note: null,
      });
    });

    it('reads the amount at the end, because people write it both ways', () => {
      expect(entry('juan valdez 12000')).toMatchObject({
        amountMinor: 1_200_000n,
        merchant: 'juan valdez',
      });
    });

    it.each([
      ['a dot as the thousands separator, which is how COP is written', '12.000 exito', 1_200_000n],
      ['a comma as the thousands separator', '12,000 exito', 1_200_000n],
      ['a currency symbol', '$12000 exito', 1_200_000n],
      ['cents when someone types them', '12000.50 exito', 1_200_050n],
      ['a million without losing a digit', '2.500.000 arriendo', 250_000_000n],
      // Three digits after a separator is a thousands group, not cents - which
      // is the right reading for COP, where "12.000" is twelve thousand. It is
      // pinned here because it is the surprising half of that rule.
      ['exactly three digits after a dot as a group', '12000.999 cafe', 1_200_099_900n],
    ])('reads %s', (_why, input, expected) => {
      expect(entry(input).amountMinor).toBe(expected);
    });

    it('treats a leading + as money coming in', () => {
      expect(entry('+2500000 salario')).toMatchObject({
        type: 'income',
        amountMinor: 250_000_000n,
      });
    });

    it('treats a leading - as someone spelling out a spend, not a negative row', () => {
      // amount_minor has a CHECK that it is positive. A negative here would be
      // a write that fails at the very end, for a line the user typed correctly.
      expect(entry('-12000 taxi')).toMatchObject({
        type: 'expense',
        amountMinor: 1_200_000n,
      });
    });

    it('keeps everything between the amount and the end as the merchant', () => {
      expect(entry('12000 cafe de la esquina').merchant).toBe('cafe de la esquina');
    });

    it('collapses the spacing somebody typed', () => {
      expect(entry('  12000   juan   valdez  ').merchant).toBe('juan valdez');
    });
  });

  describe('the note', () => {
    it('splits on a spaced dash', () => {
      expect(entry('3500 bus - ida y vuelta')).toMatchObject({
        merchant: 'bus',
        note: 'ida y vuelta',
      });
    });

    it('leaves a hyphen inside a name alone', () => {
      // "7-11" and "coca-cola" are names, not a note separator. This is why the
      // dash has to have spaces around it.
      expect(entry('12000 7-eleven')).toMatchObject({
        merchant: '7-eleven',
        note: null,
      });
    });

    it('ignores a dash with nothing after it', () => {
      expect(entry('12000 tienda -   ')).toMatchObject({ merchant: 'tienda', note: null });
    });
  });

  describe('what it refuses, and why refusing is the point', () => {
    it.each([
      ['a greeting', 'hola', 'no_amount'],
      ['a question', 'cuanto llevo este mes', 'no_amount'],
      ['a bare amount, which says nothing in a month', '12000', 'no_merchant'],
      ['an amount with only digits to call it', '12000 15000', 'no_merchant'],
      ['a bare name', 'juan valdez', 'no_amount'],
      ['zero', '0 cafe', 'not_positive'],
      ['nothing at all', '   ', 'no_amount'],
      ['more decimals than a cent could hold', '12000.9999 cafe', 'no_amount'],
    ])('refuses %s', (_why, input, reason) => {
      const result = parse(input);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe(reason);
    });

    it('does not mistake a house number for the amount', () => {
      // Only the first and last word are candidates. Scanning every token would
      // find the 7 here and file a 7-peso spend.
      expect(entry('12000 carrera 7 con 45').merchant).toBe('carrera 7 con 45');
    });

    it('does not mistake a quantity in the middle for the amount', () => {
      expect(entry('cafe x2 12000')).toMatchObject({
        merchant: 'cafe x2',
        amountMinor: 1_200_000n,
      });
    });
  });

  describe('limits', () => {
    it('truncates a merchant to what the column holds', () => {
      const long = 'a'.repeat(400);
      expect(entry(`12000 ${long}`).merchant).toHaveLength(255);
    });

    it('truncates an essay of a note', () => {
      const long = 'b'.repeat(2000);
      expect(entry(`12000 tienda - ${long}`).note).toHaveLength(1000);
    });
  });
});

/**
 * The bot's help text promises a format. This is the promise being kept.
 *
 * Every line offered as an example there has to survive this parser, and each
 * example is also asserted to still BE in the text - so the test fails whether
 * the parser drifts or the copy does. An example the bot itself rejects is the
 * worst possible first impression: the user follows the instructions, gets
 * refused, and concludes the thing is broken.
 */
describe('the examples the bot hands out', () => {
  const examples = [
    { text: '12000 juan valdez', minor: 1_200_000n, type: 'expense', merchant: 'juan valdez' },
    { text: 'café 8500', minor: 850_000n, type: 'expense', merchant: 'café' },
    { text: '$25.000 uber', minor: 2_500_000n, type: 'expense', merchant: 'uber' },
    { text: '+2500000 salario', minor: 250_000_000n, type: 'income', merchant: 'salario' },
    { text: '+80000 venta', minor: 8_000_000n, type: 'income', merchant: 'venta' },
    {
      text: '12000 tienda - almuerzo del lunes',
      minor: 1_200_000n,
      type: 'expense',
      merchant: 'tienda',
      note: 'almuerzo del lunes',
    },
  ] as const;

  it.each(examples)('reads "$text" exactly as advertised', (example) => {
    const result = parseQuickEntry(example.text, 'COP');

    expect(result.ok, `"${example.text}" was refused`).toBe(true);
    if (!result.ok) return;

    expect(result.entry.amountMinor).toBe(example.minor);
    expect(result.entry.type).toBe(example.type);
    expect(result.entry.merchant).toBe(example.merchant);
    expect(result.entry.note).toBe('note' in example ? example.note : null);
  });

  it.each(['es', 'en'] as const)('still offers a working expense and income in %s', (locale) => {
    const help = t('bot_help', locale);

    expect(help).toContain('12000 juan valdez');
    // Income is the half nobody guesses: there is no reason to know that a
    // leading '+' means money coming in unless the bot says so.
    expect(help).toMatch(/\+\d/);
  });

  it('offers every Spanish example in a form this parser accepts', () => {
    const help = t('bot_help', 'es');
    const missing = examples
      .filter((example) => !help.includes(example.text))
      .map((example) => example.text);

    expect(missing, 'the help text stopped offering these').toEqual([]);
  });
});
