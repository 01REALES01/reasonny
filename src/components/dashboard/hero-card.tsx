import Link from 'next/link';
import React from 'react';

import { Money } from '@/components/ui/money';
import { t } from '@/lib/i18n';

interface HeroCardProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
}

/**
 * Hero balance card (DESIGN_SYSTEM.md 6.1).
 *
 * The ONLY element in the app allowed to carry a gradient surface. Its colours
 * come from --hero-* tokens rather than literals, which is the rule that blocks
 * the merge: a literal here is copyable, and the second component that copies
 * it turns the one hero gradient into a system.
 *
 * Deliberately has no shadow and no border, per 6.1 - the gradient already
 * separates it from the surface behind it.
 */
export function HeroCard({
  totalBalanceMinor,
  currency,
}: HeroCardProps): React.ReactElement {
  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, var(--hero-gradient-from) 0%, var(--hero-gradient-to) 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        color: 'var(--hero-ink)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '170px',
        position: 'relative',
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
          background: 'var(--hero-mesh)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span
          style={{
            fontSize: 'var(--text-label)',
            color: 'var(--hero-ink-label)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          {t('hero_total_balance')}
        </span>
        <div
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-hero)',
            fontWeight: 700,
            color: 'var(--hero-ink)',
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
        <span
          style={{ fontSize: 'var(--text-caption)', color: 'var(--hero-ink-caption)' }}
        >
          {currency} · {t('hero_realtime')}
        </span>

        <Link
          href="/nuevo"
          style={{
            backgroundColor: 'var(--hero-action-surface)',
            color: 'var(--hero-ink)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-label)',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          + {t('hero_new_expense')}
        </Link>
      </div>
    </div>
  );
}
