import { decideConsent, POLICY_VERSION } from '@/core/privacy';
import { deleteAuthIdentity } from '@/core/repositories/auth-identity.repository';
import { hasConsent, recordConsent } from '@/core/repositories/consent.repository';
import { deleteProfile, ensureProfile } from '@/core/repositories/profile.repository';
import type { UserId } from '@/core/types';

/**
 * Whether this signed-in person may use the app now, recording the consent
 * they gave at sign-in if that is what is pending.
 *
 * Every way in passes here - the code by email, Google, and the three people
 * who signed up before the policy existed - because it runs on the first
 * authenticated page rather than inside one sign-in form. A path added later
 * cannot be born without the question.
 */
export async function resolveConsent(
  userId: UserId,
  email: string,
  intentVersion: string | undefined,
): Promise<'allow' | 'ask'> {
  const decision = decideConsent({
    hasCurrentConsent: await hasConsent(userId, POLICY_VERSION),
    intentVersion,
  });
  if (decision === 'record_from_sign_in') {
    // The row hangs from the profile, and on a first sign-in nothing has
    // created it yet.
    await ensureProfile(userId, email);
    await recordConsent(userId, POLICY_VERSION, 'sign_in');
    return 'allow';
  }
  return decision;
}

/** The authorisation screen's "Acepto". */
export async function acceptPolicy(userId: UserId, email: string): Promise<void> {
  await ensureProfile(userId, email);
  await recordConsent(userId, POLICY_VERSION, 'gate');
}

/**
 * The right to deletion (Ley 1581, art. 8 e): every row this app holds about
 * the person, in one statement. The sign-in identity lives in Neon Auth and is
 * removed by the caller, which owns the session.
 */
export async function deleteAccountData(userId: UserId): Promise<void> {
  await deleteProfile(userId);
}

/**
 * Removes the sign-in identity directly, for when Neon Auth's own delete-user
 * endpoint refuses. See auth-identity.repository for why this exists.
 */
export async function deleteSignInIdentity(userId: UserId): Promise<void> {
  await deleteAuthIdentity(userId);
}
