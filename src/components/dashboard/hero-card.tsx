import Link from 'next/link';
import React from 'react';

import { Money } from '@/components/ui/money';

interface HeroCardProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
}

/**
 * Hero balance card (DESIGN_SYSTEM.md 6.1).
 *
 * The ONLY element in the app allowed to carry a gradient surface.
 */
export function HeroCard({
  totalBalanceMinor,
  currency,
}: HeroCardProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '160px',
        position: 'relative',
      }}
    >
      <div>
        <span
          style={{
            fontSize: 'var(--text-label)',
            color: 'rgba(255, 255, 255, 0.76)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Saldo Total Disponible
        </span>
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-hero)', fontWeight: 600 }}>
          <Money amountMinor={totalBalanceMinor} currency={currency} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
        <Link
          href="/nuevo"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.28)',
            color: '#FFFFFF',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-label)',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color var(--duration-fast)',
          }}
        >
          + Nuevo Gasto
        </Link>
      </div>
    </div>
  );
}
