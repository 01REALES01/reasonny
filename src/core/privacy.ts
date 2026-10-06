/**
 * Habeas data (Ley 1581 de 2012) - the parts that are logic rather than text.
 *
 * Pure on purpose, like money.ts: whether a signed-in person may use the app
 * is a decision with three inputs, and it is tested without a database.
 */

/**
 * The policy text this build publishes, as the date it took effect.
 *
 * Bumping it is how a change to the policy reaches people: every consent row
 * names a version, so a new one finds nobody with a current consent and the
 * gate asks everyone again. Bump it only when what is collected, why, or who
 * processes it changes - a typo fix does not need anyone's agreement.
 */
export const POLICY_VERSION = '2026-10-06';

/**
 * Set by the sign-in form when the box is ticked, before the code or the
 * Google redirect. Authentication happens on Neon's side and comes back with
 * no way to carry a form field, so the box's answer waits here until the
 * first authenticated page can write it down as a consent.
 *
 * Not a secret and not proof on its own: it only spares someone who just
 * ticked the box from being asked again one screen later. The row in
 * `consents` is the proof.
 */
export const CONSENT_INTENT_COOKIE = 'reasonny_consent_intent';

/** An hour covers the slowest code-by-email round trip without lingering. */
export const CONSENT_INTENT_MAX_AGE_SECONDS = 60 * 60;

export type ConsentDecision =
  /** A consent for this version is on record. */
  | 'allow'
  /** None on record, but the box was just ticked at sign-in: record it. */
  | 'record_from_sign_in'
  /** Nothing to go on: show the authorisation screen. */
  | 'ask';

export function decideConsent(input: {
  readonly hasCurrentConsent: boolean;
  readonly intentVersion: string | undefined;
}): ConsentDecision {
  if (input.hasCurrentConsent) return 'allow';
  // An intent for an older version does not count: that box sat next to a
  // different text.
  if (input.intentVersion === POLICY_VERSION) return 'record_from_sign_in';
  return 'ask';
}
