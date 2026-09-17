import React from 'react';

import { PhoneDock } from '@/components/dashboard/phone-dock';
import { AppPermissionsPrompt } from '@/components/pwa/app-permissions-prompt';

export const dynamic = 'force-dynamic';

/**
 * Shared chrome for the authenticated app.
 *
 * Provides the floating glass capsule dock at the bottom of the viewport,
 * matching Reference Photo 1, and the initial permission onboarding prompt.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="app-shell">
      <AppPermissionsPrompt />
      {children}
      <PhoneDock />
    </div>
  );
}
