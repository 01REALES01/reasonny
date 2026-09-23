import { MAX_USABLE_ACCURACY_M } from '@/core/geo';
import {
  createAccount,
  getAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getCategory } from '@/core/repositories/category.repository';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import {
  createTransaction,
  type CategorizedBy,
  type TransactionRow,
  type TransactionSource,
  type TransactionType,
} from '@/core/repositories/transaction.repository';
import {
  confirmSuggestionUsed,
  suggestCategory,
} from '@/core/services/categorization.service';
import { toAccountId, toCategoryId, type UserId } from '@/core/types';

/**
 * The branded constructors throw a TypeError on anything that is not a uuid,
 * and this module is a trust boundary: an id arrives from a browser, a
 * Shortcut payload or a Telegram callback. A malformed one is a caller
 * mistake to be ANSWERED - "unknown_account" - not an unhandled throw that
 * becomes a 500 in a route handler that never asked to crash.
 */
function asBranded<T>(id: string, brand: (value: string) => T): T | null {
  try {
    return brand(id);
  } catch {
    return null;
  }
}

/**
 * The one place a transaction gets written.
 *
 * WHY THIS EXISTS
 * ---------------
 * Recording a spend was written twice: once in the Server Action behind /nuevo
 * and once in the /api/v1/quick-add route handler. Both resolved an account,
 * both picked a currency, both decided whether a coordinate could be stored -
 * and the two copies had already drifted apart, so there was no way to say
 * which one was right. The Telegram client would have been the third copy.
 *
 * That is what P9 means in practice: the PWA, the Shortcut and the bot are
 * three ways of SAYING "I spent 12.000 at Juan Valdez". What that sentence
 * does to the database is one decision, and it lives here.
 *
 * Callers still own what is theirs: sessions and cookies, HTTP status codes,
 * revalidatePath, the words shown to a human. None of that is in this file.
 */

/**
 * A coordinate as it arrives from outside - a browser, a Shortcut, a bot.
 *
 * Every field is optional because absent is the normal case, and the values
 * are `unknown`-ish on purpose: this is a trust boundary, and the job of
 * `resolveLocation` is to decide, not to assume the caller validated.
 */
export interface LocationCandidate {
  // `| undefined` spelled out because exactOptionalPropertyTypes is on: the
  // callers destructure straight out of a Zod result, where a field that was
  // absent is undefined and one that was explicitly cleared is null. Both mean
  // the same thing here, and neither should force a caller to rebuild the
  // object conditionally.
  readonly latitude?: number | null | undefined;
  readonly longitude?: number | null | undefined;
  readonly accuracyM?: number | null | undefined;
}

export type LocationSource = 'device_pwa' | 'shortcut' | 'manual';

export interface RecordTransactionInput {
  readonly amountMinor: bigint;
  /**
   * Set only when the SOURCE knows the currency better than the account does.
   * A bank SMS says what it charged, and relabelling that to the account's
   * currency would change what the number means. Left out, the resolved
   * account decides, and the profile's base currency is the last word.
   */
  readonly currency?: string | undefined;
  readonly type: TransactionType;
  readonly merchant: string;
  readonly note?: string | null | undefined;
  readonly transactionDate: Date;
  readonly source: TransactionSource;
  /**
   * Unverified ids, exactly as the client sent them. Ownership is checked
   * here - see `resolveAccount`.
   */
  readonly accountId?: string | null | undefined;
  readonly categoryId?: string | null | undefined;
  readonly idempotencyKey?: string | null | undefined;
  /** Defaults to 'manual' when a category was given, null when it was not. */
  readonly categorizedBy?: CategorizedBy | null | undefined;
  /**
   * Skips the rule engine. For a caller that already knows the answer is a
   * human's - the review queue, a Telegram button - where a silent
   * auto-categorisation would overwrite what the person just said.
   */
  readonly skipRuleEngine?: boolean | undefined;
  readonly location?: LocationCandidate | null | undefined;
  readonly locationSource: LocationSource;
}

export type RecordTransactionResult =
  | {
      readonly ok: true;
      readonly transaction: TransactionRow;
      readonly isDuplicate: boolean;
      /** True when the rule engine supplied the category: level 1, zero gestures. */
      readonly autoCategorized: boolean;
      /**
       * What the engine filed it as, when it did.
       *
       * Carried out rather than left for the caller to look up, because a
       * silent auto-categorisation that nobody can SEE is indistinguishable
       * from the engine not working. It rides along on the join the rule
       * lookup was already doing, so saying it costs nothing.
       */
      readonly appliedCategory: { readonly name: string; readonly icon: string } | null;
    }
  | { readonly ok: false; readonly reason: 'unknown_account' | 'unknown_category' };

function isUsableCoordinate(value: number | null | undefined): value is number {
  // Number.isFinite and not `!== null`: a coordinate reaches this from a query
  // string or a JSON body, where Number('') is 0, Number('abc') is NaN and
  // 1e999 is Infinity. A NaN latitude would satisfy every null check above and
  // then violate the CHECK constraint at the very end of the write.
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Whether this reading may be stored, and as what.
 *
 * Three gates, all of them on the server. The client can send a coordinate
 * whenever it likes; whether one is kept is decided against the profile, so a
 * client that stops asking politely cannot start a location history on its
 * own. A reading coarser than MAX_USABLE_ACCURACY_M is dropped rather than
 * shown with an apology beside it - see core/geo.ts.
 */
function resolveLocation(
  profile: ProfileRow,
  candidate: LocationCandidate | null | undefined,
  source: LocationSource,
) {
  if (!profile.locationEnabled || !candidate) {
    return null;
  }

  const { latitude, longitude } = candidate;
  if (!isUsableCoordinate(latitude) || !isUsableCoordinate(longitude)) {
    return null;
  }

  // The range belongs here and not only in each caller's schema. Every client
  // validates its own way - or forgets to - and a latitude of 91 reaching the
  // insert dies against transactions_location_check, which surfaces as a
  // driver error nobody can act on instead of as a dropped reading.
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  const accuracyM = isUsableCoordinate(candidate.accuracyM) ? candidate.accuracyM : null;
  if (accuracyM !== null && accuracyM > MAX_USABLE_ACCURACY_M) {
    return null;
  }

  return { latitude, longitude, accuracyM, source };
}

/**
 * The account this transaction lands in, and the currency that account speaks.
 *
 * A caller-supplied accountId is verified to belong to this user before it is
 * written. It arrives from a <select> in a browser or a payload on the wire,
 * and a branded type only proves it is a well-formed uuid - it says nothing
 * about ownership. transactions.account_id is a foreign key to accounts.id
 * alone, not a composite with user_id, so the database would happily store a
 * row of ours against someone else's account.
 */
async function resolveAccount(
  userId: UserId,
  profile: ProfileRow,
  requestedAccountId: string | null | undefined,
): Promise<{ accountId: ReturnType<typeof toAccountId>; currency: string } | null> {
  if (requestedAccountId) {
    const branded = asBranded(requestedAccountId, toAccountId);
    if (!branded) {
      return null;
    }
    const account = await getAccount(userId, branded);
    if (!account) {
      return null;
    }
    return { accountId: toAccountId(account.id), currency: account.currency };
  }

  const accounts = await listAccounts(userId);
  const first = accounts[0];
  if (first) {
    return { accountId: toAccountId(first.id), currency: first.currency };
  }

  // First transaction of a new profile. Cash, because that is the account
  // every one of the capture surfaces can fall back to.
  const created = await createAccount(userId, {
    name: 'Efectivo',
    type: 'cash',
    currency: profile.baseCurrency,
  });
  return { accountId: toAccountId(created.id), currency: created.currency };
}

/**
 * Records one transaction.
 *
 * The profile is passed in rather than fetched: every caller already holds it
 * (the PWA needs the base currency to parse the amount, the webhook needs it
 * to know the user exists at all), and re-reading it here would be a second
 * round trip to Neon on a path that pays a cold start.
 */
export async function recordTransaction(
  userId: UserId,
  profile: ProfileRow,
  input: RecordTransactionInput,
): Promise<RecordTransactionResult> {
  const account = await resolveAccount(userId, profile, input.accountId);
  if (!account) {
    return { ok: false, reason: 'unknown_account' };
  }

  // Same ownership check as the account, same reason. Tagging our row with
  // someone else's category would surface their category name back to us
  // through the dashboard's join.
  let categoryId = null;
  if (input.categoryId) {
    const branded = asBranded(input.categoryId, toCategoryId);
    if (!branded) {
      return { ok: false, reason: 'unknown_category' };
    }
    const category = await getCategory(userId, branded);
    if (!category) {
      return { ok: false, reason: 'unknown_category' };
    }
    categoryId = toCategoryId(category.id);
  }

  // Level 1. Only when the caller did not already name a category: an explicit
  // choice is a statement of fact and the engine does not get a vote on it.
  const suggestion =
    categoryId || input.skipRuleEngine
      ? null
      : await suggestCategory(userId, input.merchant, input.type);

  const { transaction, isDuplicate } = await createTransaction(userId, {
    accountId: account.accountId,
    categoryId: categoryId ?? suggestion?.categoryId ?? null,
    amountMinor: input.amountMinor,
    currency: input.currency ?? account.currency,
    type: input.type,
    merchant: input.merchant.trim(),
    note: input.note?.trim() || null,
    transactionDate: input.transactionDate,
    source: input.source,
    idempotencyKey: input.idempotencyKey ?? null,
    categorizedBy:
      input.categorizedBy ?? (categoryId ? 'manual' : suggestion ? 'rule_engine' : null),
    location: resolveLocation(profile, input.location, input.locationSource),
  });

  // Counted after the insert landed, and not for a duplicate: a rule that
  // "fired" on a retry of a message already stored never actually decided
  // anything, and hit_count is the number that says whether level 1 is
  // learning (P6).
  if (suggestion && !isDuplicate) {
    await confirmSuggestionUsed(userId, suggestion);
  }

  return {
    ok: true,
    transaction,
    isDuplicate,
    autoCategorized: Boolean(suggestion),
    appliedCategory: suggestion
      ? { name: suggestion.categoryName, icon: suggestion.categoryIcon }
      : null,
  };
}
