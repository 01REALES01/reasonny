'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { getAuthClient } from '@/lib/auth-client';
import { formatDate, formatTime, t } from '@/lib/i18n';

interface BalanceHeroProps {
  readonly totalBalanceMinor: bigint;
  readonly currency: string;
  readonly userEmail: string;
  /** From profiles.full_name. Null until the user sets it in /perfil. */
  readonly displayName: string | null;
  readonly monthLabel: string;
  readonly uncategorizedCount: number;
  readonly lastCaptureAt?: string | null;
  readonly autoCaptureCount?: number;
  readonly timeZone?: string;
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

function formatRelativeSyncTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'hace segundos';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

/**
 * Luxury Velvet Balance Hero.
 *
 * Grounded in Reasonny's authentic visual identity:
 * - Warm personal greeting ("Hola, Jean Paul") with interactive profile options.
 * - Prominent shortcuts access pill.
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
  lastCaptureAt,
  autoCaptureCount,
  timeZone = 'America/Bogota',
}: BalanceHeroProps): React.ReactElement {
  const [isHidden, setIsHidden] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // What the user chose to be called wins; the handle is only the fallback for
  // an account that has not been through /perfil yet.
  const name = displayName?.trim() || getGreetingName(userEmail);
  const initial = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isProfileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isProfileOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const authClient = getAuthClient();
      await authClient.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      window.location.href = '/sign-in';
    }
  }

  return (
    <div className={`balance-hero${isProfileOpen ? ' balance-hero--menu-open' : ''}`}>
      {/* 1. Top Bar: Interactive Profile trigger, Shortcut Pill, Notification Bell */}
      <div className="balance-hero-topbar">
        <div className="balance-hero-profile-wrap">
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="balance-hero-profile-trigger"
            aria-label="Menú de perfil y cuenta"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
          >
            <div className="balance-hero-avatar" title={userEmail}>
              <span className="balance-hero-initial">{initial}</span>
            </div>

            <div className="balance-hero-identity">
              <div className="balance-hero-greeting-row">
                <h1 className="balance-hero-greeting">
                  {t('greeting')}, {name}
                </h1>
                <span className="balance-hero-caret" aria-hidden="true">
                  <CategoryIcon name="ChevronDown" size={13} />
                </span>
              </div>
              <p className="balance-hero-subline">
                {t('month_summary')} {monthLabel}
              </p>
            </div>
          </button>

          {/* Menú Desplegable de Perfil */}
          {isProfileOpen && (
            <>
              <div
                className="profile-dropdown-scrim"
                onClick={() => setIsProfileOpen(false)}
                aria-hidden="true"
              />
              <div
                className="profile-dropdown-menu"
                role="menu"
                aria-label="Opciones de perfil"
              >
                {/* User Card */}
                <div className="profile-dropdown-user">
                  <div className="profile-dropdown-avatar">
                    <span className="profile-dropdown-initial">{initial}</span>
                  </div>
                  <div className="profile-dropdown-meta">
                    <span className="profile-dropdown-name">{name}</span>
                    <span className="profile-dropdown-email">{userEmail}</span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                {/* 1. Vincular app (Tutorial de Atajos) */}
                <Link
                  href="/captura"
                  onClick={() => setIsProfileOpen(false)}
                  className="profile-dropdown-item profile-dropdown-item--highlight"
                  role="menuitem"
                >
                  <span className="profile-dropdown-icon">
                    <CategoryIcon name="Zap" size={17} />
                  </span>
                  <div className="profile-dropdown-text">
                    <div className="profile-dropdown-title-row">
                      <span className="profile-dropdown-title">Vincular la app</span>
                      <span className="profile-dropdown-badge">Atajos SMS</span>
                    </div>
                    <span className="profile-dropdown-desc">
                      Tutorial paso a paso para conectar tu banco
                    </span>
                  </div>
                  <span className="profile-dropdown-arrow" aria-hidden="true">
                    <CategoryIcon name="ChevronRight" size={14} />
                  </span>
                </Link>

                {/* 2. Mi Perfil */}
                <Link
                  href="/perfil"
                  onClick={() => setIsProfileOpen(false)}
                  className="profile-dropdown-item"
                  role="menuitem"
                >
                  <span className="profile-dropdown-icon">
                    <CategoryIcon name="User" size={17} />
                  </span>
                  <div className="profile-dropdown-text">
                    <span className="profile-dropdown-title">Mi Perfil</span>
                    <span className="profile-dropdown-desc">
                      Datos de cuenta, moneda y ubicación
                    </span>
                  </div>
                  <span className="profile-dropdown-arrow" aria-hidden="true">
                    <CategoryIcon name="ChevronRight" size={14} />
                  </span>
                </Link>

                {/* 3. Resumen Mensual */}
                <Link
                  href="/mes"
                  onClick={() => setIsProfileOpen(false)}
                  className="profile-dropdown-item"
                  role="menuitem"
                >
                  <span className="profile-dropdown-icon">
                    <CategoryIcon name="PieChart" size={17} />
                  </span>
                  <div className="profile-dropdown-text">
                    <span className="profile-dropdown-title">Resumen Mensual</span>
                    <span className="profile-dropdown-desc">
                      Desglose por categorías y balance
                    </span>
                  </div>
                  <span className="profile-dropdown-arrow" aria-hidden="true">
                    <CategoryIcon name="ChevronRight" size={14} />
                  </span>
                </Link>

                {/* 4. Exportar CSV */}
                <a
                  href="/api/v1/export"
                  download
                  onClick={() => setIsProfileOpen(false)}
                  className="profile-dropdown-item"
                  role="menuitem"
                >
                  <span className="profile-dropdown-icon">
                    <CategoryIcon name="Download" size={17} />
                  </span>
                  <div className="profile-dropdown-text">
                    <span className="profile-dropdown-title">Exportar Movimientos</span>
                    <span className="profile-dropdown-desc">
                      Descarga tu historial en CSV
                    </span>
                  </div>
                  <span className="profile-dropdown-arrow" aria-hidden="true">
                    <CategoryIcon name="ChevronRight" size={14} />
                  </span>
                </a>

                <div className="profile-dropdown-divider" />

                {/* 5. Cerrar Sesión */}
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  className="profile-dropdown-signout"
                  role="menuitem"
                >
                  <CategoryIcon name="LogOut" size={15} />
                  <span>{isSigningOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="balance-hero-topbar-actions">
          {/* Prominent Shortcut Pill in topbar */}
          <Link
            href="/captura"
            className="balance-hero-shortcut-pill"
            title="Atajos SMS automáticos"
          >
            <CategoryIcon name="Zap" size={13} />
            <span>Atajos</span>
          </Link>

          {/* The bell carries the real count of transactions waiting to be categorised */}
          {uncategorizedCount > 0 && (
            <Link
              href="/revisar"
              className="balance-hero-bell"
              title={`${uncategorizedCount} ${t('dashboard_pending_review')}`}
            >
              <CategoryIcon name="Bell" size={17} />
              <span className="balance-hero-bell-dot" aria-hidden="true" />
              <span className="sr-only">
                {uncategorizedCount} {t('dashboard_pending_review')}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Central Monumental Balance Focus */}
      <div className="balance-hero-focus">
        {/* Soft Organic Diffuse Aura behind balance */}
        <div className="balance-hero-glow" aria-hidden="true" />

        <span className="balance-hero-label">{t('balance_available')}</span>

        <div className="balance-hero-amount">
          <span
            key={isHidden ? 'masked' : 'revealed'}
            className="balance-hero-amount-val"
          >
            {isHidden ? (
              <span className="balance-hero-masked">$ ••••••••</span>
            ) : (
              <Money amountMinor={totalBalanceMinor} currency={currency} />
            )}
          </span>
        </div>

        {/* The pill next to the toggle used to read "2.4% este mes". That
            number was a literal - it never came from a query, it never moved,
            and it was presented as the user's own performance. P6 requires n,
            method and a baseline for any figure, and P3 says financial content
            is cited or not said. There is no month-over-month comparison in
            getDashboardData yet, so the honest version states what the figure
            above actually is, and the delta returns when the query does. */}
        <div className="balance-hero-actions-row">
          <Link
            href="/captura"
            className="balance-hero-pill balance-hero-pill--sync"
            title={
              lastCaptureAt
                ? `Última transacción recibida: ${formatDate(lastCaptureAt, timeZone, 'es', {
                    day: 'numeric',
                    month: 'short',
                  })} a las ${formatTime(lastCaptureAt, timeZone)}`
                : 'Conectado a Bancolombia vía SMS automático'
            }
          >
            <span className="sync-pulse-dot" aria-hidden="true" />
            <span className="sync-pill-text">
              {lastCaptureAt
                ? `Bancolombia · Última tx ${formatRelativeSyncTime(lastCaptureAt)}`
                : 'Conectado a Bancolombia'}
            </span>
          </Link>

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
