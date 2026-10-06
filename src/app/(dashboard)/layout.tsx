import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import React from 'react';

import { PhoneDock } from '@/components/dashboard/phone-dock';
import { AppPermissionsPrompt } from '@/components/pwa/app-permissions-prompt';
import { CONSENT_INTENT_COOKIE } from '@/core/privacy';
import { resolveConsent } from '@/core/services/privacy.service';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Shared chrome for the authenticated app.
 *
 * Provides the floating glass capsule dock at the bottom of the viewport,
 * matching Reference Photo 1, and the initial permission onboarding prompt.
 *
 * It is also the habeas data gate (H1): nobody signed in reaches a screen of
 * the app without a consent for the current policy on record. Here and not in
 * each page, so a screen added later is covered without anyone remembering to.
 * A visitor with no session passes through - each page already sends them to
 * /sign-in, and /preview has no session on purpose.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (session) {
    const store = await cookies();
    const decision = await resolveConsent(
      toUserId(session.id),
      session.email,
      store.get(CONSENT_INTENT_COOKIE)?.value,
    );
    if (decision === 'ask') {
      redirect('/autorizacion');
    }
  }

  return (
    <div className="app-shell">
      <AppPermissionsPrompt />
      {children}
      <PhoneDock />
    </div>
  );
}
