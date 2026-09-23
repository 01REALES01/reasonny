import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';

/**
 * The way in to automatic capture, on the screen the user actually opens.
 *
 * WHY IT IS ON THE HOME SCREEN AT ALL
 * -----------------------------------
 * Linking the Shortcut is the one step that turns Reasonny from a form into
 * something that records spending by itself. Leaving it only in the profile
 * menu means a new user finds it if they already know it exists - which is
 * the one thing a new user does not know.
 *
 * WHY IT DISAPPEARS INSTEAD OF TURNING INTO A TICK
 * -----------------------------------------------
 * A "done" badge on the home screen is a permanent reminder of a task nobody
 * has to think about any more, and it competes for attention with the balance
 * every single day for one moment of reassurance on the first. Once the server
 * has seen a captured transaction the invitation has been answered, so the
 * dashboard stops rendering it - the dashboard is for money, not for a setup
 * checklist.
 *
 * The screen it points at does NOT leave with it. /captura stays reachable from
 * the profile, which is where someone goes to check that it is still running or
 * to redo it on a new phone.
 */
export function CaptureCallout(): React.ReactElement {
  return (
    <Link href="/captura" className="capture-callout" aria-label={t('capture_callout_aria')}>
      <div className="capture-callout-glow" aria-hidden="true" />
      <div className="capture-callout-inner">
        <span className="capture-callout-icon" aria-hidden="true">
          <CategoryIcon name="Zap" size={20} />
        </span>

        <div className="capture-callout-content">
          <div className="capture-callout-header">
            <span className="capture-callout-badge">{t('capture_callout_badge')}</span>
          </div>
          <span className="capture-callout-title">{t('capture_callout_title')}</span>
          <span className="capture-callout-sub">{t('capture_callout_text')}</span>
        </div>

        <span className="capture-callout-arrow" aria-hidden="true">
          <CategoryIcon name="ChevronRight" size={18} />
        </span>
      </div>
    </Link>
  );
}
