import React from 'react';

import { PhoneDock } from '@/components/dashboard/phone-dock';

/**
 * Shared chrome for the authenticated app.
 *
 * Provides the floating glass capsule dock at the bottom of the viewport,
 * matching Reference Photo 1.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="app-shell">
      {children}
      <PhoneDock />
    </div>
  );
}
