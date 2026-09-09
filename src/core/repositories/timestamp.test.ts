import { describe, expect, it } from 'vitest';

import { toDateOrNull } from './transaction.repository';

/**
 * The profile page returned a 500 the moment the first automatic capture
 * landed, because a `sql<Date>` assertion promised a Date and the driver
 * delivered a string. Nothing catches that at compile time - the assertion IS
 * the compile-time answer - so it has to be caught here.
 */
describe('toDateOrNull', () => {
  const expected = Date.UTC(2026, 8, 9, 23, 42, 44, 225);

  it('reads the text form of a timestamptz that Postgres actually returns', () => {
    const value = toDateOrNull('2026-09-09 23:42:44.225699+00');

    expect(value).toBeInstanceOf(Date);
    expect(value?.getTime()).toBe(expected);
  });

  it('honours a non-zero offset instead of reading it as UTC', () => {
    // The same instant, written from Bogota. Getting this wrong would move a
    // late-evening capture into the next day.
    expect(toDateOrNull('2026-09-09 18:42:44.225699-05')?.getTime()).toBe(expected);
  });

  it('passes a Date through, in case the driver ever starts parsing them', () => {
    const date = new Date(expected);
    expect(toDateOrNull(date)).toBe(date);
  });

  it.each([null, undefined, '', 'not a timestamp'])('answers null for %s', (value) => {
    expect(toDateOrNull(value)).toBeNull();
  });
});
