'use client';

import Link from 'next/link';
import React, { useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { t } from '@/lib/i18n';

interface HeroCardProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
}

/**
 * Hero balance card (DESIGN_SYSTEM.md 6.1).
 *
 * The single element in the app allowed a gradient surface: deep imperial wine
 * into velvet obsidian, framed with a champagne gold hairline. The figure sets
 * the scale of the screen, complemented by a subtle SVG telemetry sparkline.
 *
 * Includes the required balance privacy toggle (DESIGN_SYSTEM.md 6.1:
 * "Acción de ocultar/mostrar saldo en la esquina superior derecha").
 */
export function HeroCard({
  totalBalanceMinor,
  currency,
}: HeroCardProps): React.ReactElement {
  const [isHidden, setIsHidden] = useState(false);

  return (
    <section className="hero-card">
      <div className="hero-card-head">
        <span className="hero-card-label">{t('hero_total_balance')}</span>

        <button
          type="button"
          onClick={() => setIsHidden((prev) => !prev)}
          className="hero-privacy-btn"
          aria-label={isHidden ? t('hero_show_balance') : t('hero_hide_balance')}
          title={isHidden ? t('hero_show_balance') : t('hero_hide_balance')}
        >
          <CategoryIcon name={isHidden ? 'Eye' : 'EyeOff'} size={15} />
        </button>
      </div>

      {/* Pure SVG Telemetry wave - strictly uses CSS variables, zero color literals */}
      <svg
        className="hero-sparkline"
        viewBox="0 0 240 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0 65 Q 40 50, 80 58 T 150 35 T 210 20 T 240 10"
          stroke="var(--landing-champagne-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M0 65 Q 40 50, 80 58 T 150 35 T 210 20 T 240 10 V 90 H 0 Z"
          fill="url(#sparkline-fill)"
          opacity="0.25"
        />
        <defs>
          <linearGradient
            id="sparkline-fill"
            x1="120"
            y1="0"
            x2="120"
            y2="90"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--landing-champagne-gold)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--landing-champagne-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="hero-card-figure">
        {isHidden ? (
          <span className="hero-card-masked" aria-label={t('hero_hide_balance')}>
            $ ••••••••
          </span>
        ) : (
          <Money amountMinor={totalBalanceMinor} currency={currency} />
        )}
      </div>

      <div className="hero-card-foot">
        <span className="hero-card-caption">
          <CategoryIcon name="ShieldCheck" size={13} />
          <span>
            {currency} · {t('hero_realtime')}
          </span>
        </span>

        <Link href="/nuevo" className="hero-card-action">
          <CategoryIcon name="Plus" size={15} />
          <span>{t('hero_new_expense')}</span>
        </Link>
      </div>
    </section>
  );
}
