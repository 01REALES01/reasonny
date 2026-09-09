import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

/**
 * The way in to automatic capture, on the screen the user actually opens.
 *
 * WHY IT DISAPPEARS INSTEAD OF TURNING INTO A TICK
 * -----------------------------------------------
 * A "done" badge on the home screen is a permanent reminder of a task nobody
 * has to think about any more, and it competes for attention with the balance
 * every single day for one moment of reassurance on the first. Once the server
 * has seen a captured transaction the invitation has been answered, so it
 * leaves - the dashboard is for money, not for a setup checklist.
 *
 * The screen it points at does NOT leave with it. /captura stays reachable from
 * the profile, which is where someone goes to check that it is still running or
 * to redo it on a new phone.
 */
export function CaptureCallout(): React.ReactElement {
  return (
    <Link href="/captura" className="capture-callout">
      <span className="capture-callout-icon" aria-hidden="true">
        <CategoryIcon name="Nfc" size={20} />
      </span>

      <span className="capture-callout-text">
        <span className="capture-callout-title">Que se guarden solos</span>
        <span className="capture-callout-sub">
          Conecta el SMS de tu banco. Una vez, y ya.
        </span>
      </span>

      <CategoryIcon name="ChevronRight" size={18} />
    </Link>
  );
}
