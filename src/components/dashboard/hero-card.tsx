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
        minHeight: '170px',
        position: 'relative',
        boxShadow: '0 12px 32px rgba(194, 65, 12, 0.25)',
        overflow: 'hidden',
      }}
    >
      {/* Subtle decorative mesh circle */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span
          style={{
            fontSize: 'var(--text-label)',
            color: 'rgba(255, 255, 255, 0.82)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Saldo Total Disponible
        </span>
        <div
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-hero)',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.1,
          }}
        >
          <Money amountMinor={totalBalanceMinor} currency={currency} />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-4)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 'var(--text-caption)', color: 'rgba(255, 255, 255, 0.75)' }}>
          {currency} · Actualizado en tiempo real
        </span>

        <Link
          href="/nuevo"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.32)',
            color: '#FFFFFF',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-label)',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          + Nuevo Gasto
        </Link>
      </div>
    </div>
  );
}
