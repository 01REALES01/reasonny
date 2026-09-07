'use client';

import React, { useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { t } from '@/lib/i18n';

interface BalanceHeroProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
  readonly userEmail: string;
  readonly monthLabel: string;
}

function getGreetingName(email: string): string {
  const lower = email.toLowerCase();
  if (lower.includes('reales') || lower.includes('jean')) {
    return 'Jean Paul';
  }
  const handle = email.split('@')[0] ?? 'Usuario';
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

/**
 * Luxury Velvet Balance Hero.
 *
 * Grounded in Reasonny's authentic visual identity:
 * - Warm personal greeting ("Hola, Jean Paul").
 * - Organic, diffuse imperial vinotinto & champagne gold volumetric lighting.
 * - Monumental available balance with <Money> and tap-to-mask privacy.
 * - Month pacing indicator.
 */
export function BalanceHero({
  totalBalanceMinor,
  currency,
  userEmail,
  monthLabel,
}: BalanceHeroProps): React.ReactElement {
  const [isHidden, setIsHidden] = useState(false);
  const name = getGreetingName(userEmail);
  const initial = name.slice(0, 2).toUpperCase();

  return (
    <div className="balance-hero">
      {/* 1. Top Bar: Avatar, Greeting, Notification */}
      <div className="balance-hero-topbar">
        <div className="balance-hero-avatar" title={userEmail}>
          <span className="balance-hero-initial">{initial}</span>
        </div>

        <div className="balance-hero-identity">
          <h1 className="balance-hero-greeting">Hola, {name}</h1>
          <p className="balance-hero-subline">
            Resumen de {monthLabel}
          </p>
        </div>

        <button
          type="button"
          className="balance-hero-bell"
          aria-label={t('dashboard_pending_review')}
        >
          <CategoryIcon name="Bell" size={17} />
          <span className="balance-hero-bell-dot" aria-hidden="true" />
        </button>
      </div>

      {/* 2. Central Monumental Balance Focus */}
      <div className="balance-hero-focus">
        {/* Soft Organic Diffuse Aura behind balance */}
        <div className="balance-hero-glow" aria-hidden="true" />

        <span className="balance-hero-label">Saldo disponible</span>

        <div className="balance-hero-amount">
          {isHidden ? (
            <span className="balance-hero-masked">$ ••••••••</span>
          ) : (
            <Money amountMinor={totalBalanceMinor} currency={currency} />
          )}
        </div>

        {/* Delta / Status Pill */}
        <div className="balance-hero-actions-row">
          <div className="balance-hero-pill">
            <CategoryIcon name="TrendingUp" size={13} />
            <span>2.4% este mes</span>
          </div>

          <button
            type="button"
            onClick={() => setIsHidden((prev) => !prev)}
            className="balance-hero-mask-toggle"
            aria-label={isHidden ? t('hero_show_balance') : t('hero_hide_balance')}
          >
            <CategoryIcon name={isHidden ? 'Eye' : 'EyeOff'} size={13} />
            <span>{isHidden ? 'Mostrar' : 'Ocultar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
