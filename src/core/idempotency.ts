import { createHash } from 'node:crypto';

/**
 * Turning "the same thing arrived twice" into a value a UNIQUE index can hold.
 *
 * Every capture surface has a retry story. The SMS Shortcut fires again when
 * iOS decides the first run did not finish; Telegram redelivers an update it
 * did not get a 200 for; a user taps Send twice on a slow connection. In all
 * three the second arrival is the SAME event, and the database - not the
 * application - has to be the thing that refuses it, because two concurrent
 * requests both pass a `SELECT ... WHERE key = ?` before either inserts
 * (CLAUDE.md rule 6).
 *
 * So the key is derived, never generated: identical input yields an identical
 * uuid, `ON CONFLICT DO NOTHING` drops the second row, and neither request
 * needs to know the other existed.
 *
 * WHAT GOES IN THE SEED
 * ---------------------
 * Whatever identifies the EVENT, not the content. A Telegram message id is
 * perfect: sending "12000 juan valdez" twice on purpose is two spends and gets
 * two ids, while a redelivery of one message is one spend and one id. Hashing
 * the text alone would silently swallow the second coffee of the day.
 */
export function uuidFromSeed(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');

  // Shaped as a v4 uuid because the column is `uuid` and Postgres validates
  // the variant bits. The randomness is gone by construction - that is the
  // whole point - but the format still has to be legal.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
