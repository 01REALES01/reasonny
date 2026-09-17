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
interface CaptureCalloutProps {
  readonly count?: number;
}

/**
 * Signature shortcut automation callout on the home screen.
 *
 * Grounded in Reasonny's champagne and rosé velvet aesthetic.
 * Gives prominent visibility to the iOS Shortcuts automated capture feature:
 * - When 0 captures: Prompts user to start the 2-minute bank SMS connection.
 * - When >0 captures: Displays active status badge and transaction count.
 */
export function CaptureCallout({ count = 0 }: CaptureCalloutProps): React.ReactElement {
  const isConfigured = count > 0;

  return (
    <Link
      href="/captura"
      className={`capture-callout${isConfigured ? ' capture-callout--active' : ''}`}
      aria-label={
        isConfigured
          ? 'Atajos activos. Toca para ver configuración o tutorial.'
          : 'Configurar captura automática de SMS con Atajos'
      }
    >
      <div className="capture-callout-glow" aria-hidden="true" />
      <div className="capture-callout-inner">
        <span className="capture-callout-icon" aria-hidden="true">
          <CategoryIcon name={isConfigured ? 'Check' : 'Zap'} size={20} />
        </span>

        <div className="capture-callout-content">
          <div className="capture-callout-header">
            <span className="capture-callout-badge">
              {isConfigured ? 'Atajos activos' : 'Pieza clave'}
            </span>
            {isConfigured && (
              <span className="capture-callout-count">
                {count} {count === 1 ? 'gasto registrado' : 'gastos registrados'}
              </span>
            )}
          </div>
          <span className="capture-callout-title">
            {isConfigured ? 'Automatización bancaria lista' : 'Guarda tus gastos al instante'}
          </span>
          <span className="capture-callout-sub">
            {isConfigured
              ? 'Tus SMS se procesan solos. Toca para ver o reconfigurar tu banco.'
              : 'Conecta los SMS de tu banco con Atajos de iOS. No vuelvas a digitar a mano.'}
          </span>
        </div>

        <span className="capture-callout-arrow" aria-hidden="true">
          <CategoryIcon name="ChevronRight" size={18} />
        </span>
      </div>
    </Link>
  );
}
