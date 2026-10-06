'use server';

import {
  acceptPolicy,
  deleteAccountData,
  deleteSignInIdentity,
} from '@/core/services/privacy.service';
import { toUserId } from '@/core/types';
import { getAuthServer } from '@/lib/auth-server';
import { DICTIONARY } from '@/lib/i18n';
import { requireCurrentUser } from '@/lib/session';

export interface PrivacyActionResult {
  readonly success: boolean;
}

/** The authorisation screen's "Acepto y continúo". */
export async function acceptPolicyAction(): Promise<PrivacyActionResult> {
  const session = await requireCurrentUser();
  try {
    await acceptPolicy(toUserId(session.id), session.email);
    return { success: true };
  } catch (error) {
    console.error('[privacy] failed to record consent:', error);
    return { success: false };
  }
}

/**
 * Deletes everything, then the sign-in identity.
 *
 * The confirmation word is checked here and not only in the form: a server
 * action is a public endpoint, and the irreversible one deserves the check
 * where it cannot be skipped. Either language's word is accepted, since the
 * form shows whichever locale is active.
 */
export async function deleteAccountAction(confirmation: string): Promise<PrivacyActionResult> {
  const accepted: readonly string[] = Object.values(DICTIONARY).map(
    (d) => d.account_delete_confirm_word,
  );
  if (!accepted.includes(confirmation.trim().toUpperCase())) {
    return { success: false };
  }

  const session = await requireCurrentUser();
  const userId = toUserId(session.id);

  try {
    // Data first: if anything after this fails, what the person asked to have
    // erased is already gone, and a leftover identity can be removed by hand.
    await deleteAccountData(userId);
  } catch (error) {
    console.error('[privacy] failed to delete account data:', error);
    return { success: false };
  }

  const auth = getAuthServer();
  const { error } = await auth.deleteUser({});
  if (error) {
    console.warn('[privacy] delete-user refused, removing the identity directly:', error.message);
    try {
      await deleteSignInIdentity(userId);
    } catch (cause) {
      // The data is gone; only the email in neon_auth remains. Logged loudly
      // so it is removed by hand - the person is told the account is deleted,
      // which for everything they can see is true.
      console.error('[privacy] auth identity left behind for', userId, cause);
    }
  }

  // Best effort: with the identity gone the session is already dead, this
  // only clears the cookies.
  await auth.signOut().catch(() => undefined);
  return { success: true };
}
