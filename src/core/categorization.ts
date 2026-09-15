/**
 * Turning a merchant name into the key the rule engine matches on.
 *
 * Pure, like money.ts, and for the same reason: it is testable without a
 * database and it is the one place the rule is written down.
 *
 * WHY THERE IS NO SQL TWIN OF THIS FUNCTION
 * -----------------------------------------
 * The obvious alternative is to normalise in the query - `lower(unaccent(...))`
 * in the WHERE - and skip the column entirely. It cannot be allowed here.
 * A Postgres expression and a TypeScript function that "do the same thing"
 * agree on every example anyone thinks to try and diverge on the first Unicode
 * edge case nobody did, and no test would catch it because each side passes its
 * own. The engine would silently stop matching a merchant and look like it
 * never learned.
 *
 * So the key is computed HERE, once, and both the value written to
 * transactions.merchant_normalized and the value compared against
 * categorization_rules.merchant_pattern come out of this function.
 */

/**
 * The column both sides of the match are stored in. Truncating here rather than
 * letting Postgres do it means a name over the limit produces the same key on
 * the write path and the read path, instead of one being cut and the other not.
 */
const MAX_LENGTH = 255;

/** Combining marks left behind by NFD decomposition: the accents themselves. */
const DIACRITICS = /\p{M}+/gu;

/**
 * The comparable form of a merchant name.
 *
 * `Café  Juan Valdez ` and `CAFE JUAN VALDEZ` are the same shop written by two
 * different sources - a person typing it into /nuevo and a bank writing it in
 * an SMS - and the engine has to see one key for both.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * No tokenising, no stopword list, no stripping of branch numbers or reference
 * codes. Every one of those is a guess about what part of the name identifies
 * the shop, and this codebase's doctrine everywhere else - the SMS parsers, the
 * amount reader - is that a wrong answer is worse than no answer. Exact match
 * means `TIENDA GENERICA 170` and `TIENDA GENERICA 45` are two merchants. That
 * is correct until there is evidence it is not.
 *
 * Two properties the tests pin, because the rest of the design rests on them:
 * it is idempotent, so normalising a stored key again yields the same key; and
 * it never lengthens the input, so the truncation above can never make the
 * write path and the read path disagree.
 *
 * Returns '' for a name that is blank or only punctuation-free whitespace.
 * Callers must treat '' as "no key": as a rule pattern it would match every
 * blank merchant at once.
 */
export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    // Collapse before trimming, so a name that is only whitespace lands on ''
    // in one step rather than leaving a stray single space behind.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}
