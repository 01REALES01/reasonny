import { cookies } from 'next/headers';

import { hasAnyTransaction } from '@/core/repositories/transaction.repository';
import type { ProfileRow } from '@/core/repositories/profile.repository';
import type { UserId } from '@/core/types';

/**
 * Marks that this browser has already been shown the welcome flow.
 *
 * A cookie rather than a column, deliberately. The natural condition for "new
 * user" - no name and no transactions - is still true for someone who skipped
 * the intro, so on their next visit the redirect would fire again, and again,
 * with no way out except recording a spend. Something has to remember that the
 * flow was already offered.
 *
 * A column (`profiles.onboarded_at`) would be the durable answer and would
 * survive a new device. It needs a versioned migration applied to a Neon branch
 * first, so it is not something to slip into a UI change; a cookie costs
 * nothing and its worst failure is showing a welcome screen once more on a
 * second device, which is not a bad outcome for a welcome screen.
 */
export const ONBOARDING_COOKIE = 'reasonny_welcomed';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function markOnboardingSeen(): Promise<void> {
  const store = await cookies();
  store.set(ONBOARDING_COOKIE, '1', {
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/**
 * True only for an account with nothing in it that has not already been
 * offered the intro.
 *
 * The transaction check runs last and only when the cheap checks have already
 * passed, so the returning user - who is almost everyone, almost always - pays
 * a cookie read and nothing else.
 */
export async function shouldShowOnboarding(
  userId: UserId,
  profile: ProfileRow,
): Promise<boolean> {
  if (profile.fullName) {
    return false;
  }

  const store = await cookies();
  if (store.get(ONBOARDING_COOKIE)) {
    return false;
  }

  return !(await hasAnyTransaction(userId));
}
