'use client';

import React, { useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { t } from '@/lib/i18n';

interface BalanceHeroProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
  readonly userEmail: string;
  /** From profiles.full_name. Null until the user sets it in /perfil. */
  readonly displayName: string | null;
  readonly monthLabel: string;
  readonly uncategorizedCount: number;
}

/**
 * Best-effort display name from the email handle.
 *
 * No special-casing by address: matching "jean" or "reales" and answering
 * "Jean Paul" greets the wrong person the first time anyone named Jeanette or
 * Realeses signs up, and it is the kind of bug nobody reports - they just feel
 * the product does not know them. Separators become spaces so
 * `jean.paul@` reads as "Jean Paul" for everyone it actually applies to.
 */
function getGreetingName(email: string): string {
  const handle = email.split('@')[0] ?? '';
  const words = handle
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return email;
  }

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
  displayName,
  monthLabel,
  uncategorizedCount,
}: BalanceHeroProps): React.ReactElement {
  const [isHidden, setIsHidden] = useState(false);
  // What the user chose to be called wins; the handle is only the fallback for
  // an account that has not been through /perfil yet.
  const name = displayName?.trim() || getGreetingName(userEmail);
  const initial = name.slice(0, 2).toUpperCase();

  return (
    <div className="balance-hero">
      {/* 1. Top Bar: Avatar, Greeting, Notification */}
      <div className="balance-hero-topbar">
        <div className="balance-hero-avatar" title={userEmail}>
          <span className="balance-hero-initial">{initial}</span>
        </div>

        <div className="balance-hero-identity">
          <h1 className="balance-hero-greeting">
            {t('greeting')}, {name}
          </h1>
          <p className="balance-hero-subline">
            {t('month_summary')} {monthLabel}
          </p>
        </div>

        {/* The bell used to be a button with no handler and a red dot that was
            always lit, so it promised notifications the app cannot send. It is
            a status indicator now: it carries the real count of transactions
            waiting to be categorised, and it is absent when there are none. */}
        {uncategorizedCount > 0 && (
          <span
            className="balance-hero-bell"
            title={`${uncategorizedCount} ${t('dashboard_pending_review')}`}
          >
            <CategoryIcon name="Bell" size={17} />
            <span className="balance-hero-bell-dot" aria-hidden="true" />
            <span className="sr-only">
              {uncategorizedCount} {t('dashboard_pending_review')}
            </span>
          </span>
        )}
      </div>

      {/* 2. Central Monumental Balance Focus */}
      <div className="balance-hero-focus">
        {/* Soft Organic Diffuse Aura behind balance */}
        <div className="balance-hero-glow" aria-hidden="true" />

        <span className="balance-hero-label">{t('balance_available')}</span>

        <div className="balance-hero-amount">
          {isHidden ? (
            <span className="balance-hero-masked">$ ••••••••</span>
          ) : (
            <Money amountMinor={totalBalanceMinor} currency={currency} />
          )}
        </div>

        {/* The pill next to the toggle used to read "2.4% este mes". That
            number was a literal - it never came from a query, it never moved,
            and it was presented as the user's own performance. P6 requires n,
            method and a baseline for any figure, and P3 says financial content
            is cited or not said. There is no month-over-month comparison in
            getDashboardData yet, so the honest version states what the figure
            above actually is, and the delta returns when the query does. */}
        <div className="balance-hero-actions-row">
          <div className="balance-hero-pill">
            <CategoryIcon name="ShieldCheck" size={13} />
            <span>
              {currency} · {t('hero_realtime')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsHidden((prev) => !prev)}
            className="balance-hero-mask-toggle"
            aria-label={isHidden ? t('hero_show_balance') : t('hero_hide_balance')}
          >
            <CategoryIcon name={isHidden ? 'Eye' : 'EyeOff'} size={13} />
            <span>{isHidden ? t('hero_show_short') : t('hero_hide_short')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
