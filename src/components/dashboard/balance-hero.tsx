'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { getAuthClient } from '@/lib/auth-client';
import { formatDate, formatTime, t } from '@/lib/i18n';

interface BalanceHeroProps {
  readonly totalBalanceMinor: bigint;
  readonly monthExpenseMinor?: bigint;
  readonly currency: string;
  readonly userEmail: string;
  /** From profiles.full_name. Null until the user sets it in /perfil. */
  readonly displayName: string | null;
  readonly monthLabel: string;
  readonly uncategorizedCount: number;
  readonly lastCaptureAt?: string | null | undefined;
  readonly autoCaptureCount?: number | undefined;
  readonly timeZone?: string | undefined;
  readonly accounts?: readonly UserAccountItem[] | undefined;
  readonly activeCardIndex?: number | undefined;
  readonly onCardChange?: ((index: number, card: FormattedWalletCard) => void) | undefined;
}

export interface UserAccountItem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly currency: string;
  readonly color?: string | undefined;
  readonly balanceMinor?: bigint | undefined;
}

export interface FormattedWalletCard {
  readonly id: string;
  readonly displayName: string;
  readonly mask: string | null;
  readonly last4: string | null;
  readonly bankName: string;
  readonly brandBadge: string;
  readonly typeLabel: string;
  readonly balanceMinor?: bigint | undefined;
  readonly currency: string;
}

/** The consolidated card that leads the stack. Not an account id. */
export const GENERAL_CARD_ID = 'all-accounts-general';

function parseAccountCard(acc: UserAccountItem): FormattedWalletCard {
  const name = acc.name.trim();

  // 1. Detect 4 digits if present in the account name (e.g. "Davivienda *0000" or "Nu 1111")
  const digitsMatch = name.match(/(?:[*•·#\s]|^)(\d{4})\b/);
  const last4 = digitsMatch?.[1] ?? null;
  const mask = last4 ? `•••• ${last4}` : null;

  // 2. Detect Bank
  let bankName = name;
  let brandBadge = '';

  if (/davivienda/i.test(name)) {
    bankName = 'Davivienda';
    brandBadge = 'DAVIVIENDA';
  } else if (/bancolombia/i.test(name)) {
    bankName = 'Bancolombia';
    brandBadge = 'BANCOLOMBIA';
  } else if (/nequi/i.test(name)) {
    bankName = 'Nequi';
    brandBadge = 'NEQUI';
  } else if (/daviplata/i.test(name)) {
    bankName = 'Daviplata';
    brandBadge = 'DAVIPLATA';
  } else if (/\bnu\b|nubank/i.test(name)) {
    bankName = 'Nu Colombia';
    brandBadge = 'NU';
  } else if (/lulo/i.test(name)) {
    bankName = 'Lulo Bank';
    brandBadge = 'LULO';
  } else if (/bogot[aá]/i.test(name)) {
    bankName = 'Banco de Bogotá';
    brandBadge = 'BOGOTÁ';
  } else if (/occidente/i.test(name)) {
    bankName = 'Banco de Occidente';
    brandBadge = 'OCCIDENTE';
  } else if (/popular/i.test(name)) {
    bankName = 'Banco Popular';
    brandBadge = 'POPULAR';
  } else if (/bbva/i.test(name)) {
    bankName = 'BBVA';
    brandBadge = 'BBVA';
  } else if (/colpatria/i.test(name)) {
    bankName = 'Scotiabank Colpatria';
    brandBadge = 'COLPATRIA';
  } else if (/falabella/i.test(name)) {
    bankName = 'Banco Falabella';
    brandBadge = 'FALABELLA';
  } else if (/rappi/i.test(name)) {
    bankName = 'RappiPay';
    brandBadge = 'RAPPIPAY';
  } else if (/efectivo|cash/i.test(name)) {
    bankName = 'Efectivo';
    brandBadge = 'EFECTIVO';
  } else {
    const firstWord = name.split(/[\s·-]+/)[0] ?? name;
    brandBadge = firstWord.length <= 12 ? firstWord.toUpperCase() : 'CUENTA';
  }

  // 3. Specific card network only if explicitly included in the user's account name
  if (/visa/i.test(name)) {
    brandBadge = 'VISA';
  } else if (/mastercard/i.test(name)) {
    brandBadge = 'MASTERCARD';
  } else if (/amex|american\s*express/i.test(name)) {
    brandBadge = 'AMEX';
  }

  // 4. Real account type in Spanish (Ahorros, Crédito, Corriente, etc.)
  let typeLabel = 'Cuenta';
  switch (acc.type) {
    case 'credit_card':
      typeLabel = 'Crédito';
      break;
    case 'savings':
      typeLabel = 'Ahorros';
      break;
    case 'checking':
      typeLabel = 'Corriente';
      break;
    case 'digital_wallet':
      typeLabel = 'Bolsillo';
      break;
    case 'cash':
      typeLabel = 'Efectivo';
      break;
    default:
      typeLabel = 'Activa';
  }

  return {
    id: acc.id,
    displayName: name,
    mask,
    last4,
    bankName,
    brandBadge,
    typeLabel,
    balanceMinor: acc.balanceMinor,
    currency: acc.currency,
  };
}

function CardBrandMark({ brand }: { readonly brand: string }): React.ReactElement {
  const norm = brand.trim().toUpperCase();
  if (norm === 'GENERAL' || norm === 'TODAS' || norm === 'CONSOLIDADO') {
    return (
      <span className="balance-card-brand-with-icon" aria-label={t('wallet_all_accounts')}>
        <svg className="balance-card-bank-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
        <span className="balance-card-brand-txt">{t('wallet_general').toUpperCase()}</span>
      </span>
    );
  }
  if (norm === 'VISA') {
    return <span className="balance-card-logo--visa">VISA</span>;
  }
  if (norm === 'MASTERCARD') {
    return (
      <span className="balance-card-logo--mc" aria-label="Mastercard">
        <span className="balance-card-mc-circle balance-card-mc-circle--red" />
        <span className="balance-card-mc-circle balance-card-mc-circle--gold" />
      </span>
    );
  }
  if (norm === 'NU' || norm === 'NUBANK') {
    return (
      <span className="balance-card-logo--nu" aria-label="Nu">
        nu
      </span>
    );
  }
  if (norm === 'DAVIVIENDA') {
    return (
      <span className="balance-card-brand-with-icon" aria-label="Davivienda">
        <svg className="balance-card-bank-svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 3.8l5 4.5v6.7H7v-6.7l5-4.5z" />
        </svg>
        <span className="balance-card-brand-txt">DAVIVIENDA</span>
      </span>
    );
  }
  if (norm === 'BANCOLOMBIA') {
    return (
      <span className="balance-card-brand-with-icon" aria-label="Bancolombia">
        <svg className="balance-card-bank-svg" width="18" height="12" viewBox="0 0 26 16" fill="currentColor" aria-hidden="true">
          <path d="M0 0h26v3H0zM4 6.5h18v3H4zM8 13h10v3H8z" />
        </svg>
        <span className="balance-card-brand-txt">BANCOLOMBIA</span>
      </span>
    );
  }
  return <span className="balance-card-brand-txt">{brand}</span>;
}

function ContactlessWaveIcon(): React.ReactElement {
  return (
    <svg
      className="balance-card-nfc-icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8.5 7.5a6 6 0 0 1 0 9" />
      <path d="M12 4.5a10 10 0 0 1 0 15" />
      <path d="M15.5 1.5a14 14 0 0 1 0 21" />
    </svg>
  );
}

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
 * Modern Liquid Glass Hero (iPhone Reference).
 *
 * Implements the warm volumetric sunset glow with layered frosted glass
 * cards, circular top actions, monumental balance, and interactive card stack.
 */
export function BalanceHero({
  totalBalanceMinor,
  monthExpenseMinor = 0n,
  currency,
  userEmail,
  displayName,
  monthLabel,
  uncategorizedCount,
  lastCaptureAt,
  autoCaptureCount,
  timeZone = 'America/Bogota',
  accounts,
  activeCardIndex: propActiveCardIndex,
  onCardChange,
}: BalanceHeroProps): React.ReactElement {
  const [isHidden, setIsHidden] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeView, setActiveView] = useState<'available' | 'spent'>('available');
  const [internalCardIndex, setInternalCardIndex] = useState(0);

  const activeCardIndex = propActiveCardIndex !== undefined ? propActiveCardIndex : internalCardIndex;

  const name = displayName?.trim() || getGreetingName(userEmail);
  const initial = name.slice(0, 2).toUpperCase();

  // Pacing calculations in user's timezone
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);

  const currentDay = Number(parts.find((p) => p.type === 'day')?.value ?? now.getDate());
  const currentMonth = Number(
    parts.find((p) => p.type === 'month')?.value ?? now.getMonth() + 1,
  );
  const currentYear = Number(
    parts.find((p) => p.type === 'year')?.value ?? now.getFullYear(),
  );

  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay);
  const monthProgressPct = Math.min(
    100,
    Math.max(1, Math.round((currentDay / daysInMonth) * 100)),
  );

  const dailyPaceMinor =
    currentDay > 0 ? monthExpenseMinor / BigInt(currentDay) : 0n;

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

  // 1. Primary card: "General (Todas las cuentas)" - default consolidated view
  const generalCard: FormattedWalletCard = {
    id: GENERAL_CARD_ID,
    displayName: t('wallet_all_accounts'),
    mask: null,
    last4: null,
    bankName: t('wallet_general'),
    brandBadge: 'GENERAL',
    typeLabel: t('wallet_consolidated'),
    balanceMinor: totalBalanceMinor,
    currency,
  };

  const parsedAccountCards = accounts && accounts.length > 0
    ? accounts.map(parseAccountCard)
    : [];

  const walletCards: readonly FormattedWalletCard[] =
    parsedAccountCards.length > 0
      ? [generalCard, ...parsedAccountCards]
      : [generalCard];

  const currentCard = walletCards[activeCardIndex % walletCards.length] ?? generalCard;

  const isShowingAvailable = activeView === 'available';
  // The month's spend is only known for all accounts together, so the "spent"
  // view keeps the general label whichever card is in front. Labelling it
  // "Gastado · Bancolombia" put every bank's spend under one bank's name.
  // A card whose balance did not load falls back to the total under the total's
  // own label, never under the bank's.
  const accountBalanceMinor =
    currentCard.id === GENERAL_CARD_ID ? undefined : currentCard.balanceMinor;
  const showsAccountBalance = isShowingAvailable && accountBalanceMinor !== undefined;
  const displayedAmount = !isShowingAvailable
    ? monthExpenseMinor
    : (accountBalanceMinor ?? totalBalanceMinor);
  const displayedCurrency = showsAccountBalance ? currentCard.currency : currency;

  const labelTitle = !isShowingAvailable
    ? `Gastado en ${monthLabel.split(' ')[0] ?? 'el mes'}`
    : showsAccountBalance
      ? `${t('hero_account_balance')} · ${currentCard.bankName}`
      : t('hero_balance_combined');

  return (
    <>
      <div className={`balance-hero balance-hero--liquid-glass${isProfileOpen ? ' balance-hero--menu-open' : ''}`}>
      {/* 1. iPhone Top Bar: Profile avatar on left, Circular frosted Bell on right */}
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
                <span className="balance-hero-greeting">
                  {name}
                </span>
                <span className={`balance-hero-caret${isProfileOpen ? ' balance-hero-caret--open' : ''}`} aria-hidden="true">
                  <CategoryIcon name="ChevronDown" size={12} />
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Right: Circular Frosted Glass Action Buttons (Mask + Bell) */}
        <div className="balance-hero-topbar-actions">
          <button
            type="button"
            onClick={() => setIsHidden((prev) => !prev)}
            className="balance-hero-glass-action-btn"
            aria-label={isHidden ? t('hero_show_balance') : t('hero_hide_balance')}
            title={isHidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          >
            <CategoryIcon name={isHidden ? 'Eye' : 'EyeOff'} size={16} />
          </button>

          <Link
            href={uncategorizedCount > 0 ? '/revisar' : '/captura'}
            className="balance-hero-glass-bell"
            title={
              uncategorizedCount > 0
                ? `${uncategorizedCount} ${t('dashboard_pending_review')}`
                : 'Notificaciones y Atajos'
            }
            aria-label="Notificaciones"
          >
            <CategoryIcon name="Bell" size={17} />
            {uncategorizedCount > 0 && (
              <span className="balance-hero-glass-bell-dot" aria-hidden="true" />
            )}
          </Link>
        </div>
      </div>

      {/* 2. Central Monumental Typography */}
      <div className="balance-hero-focus">
        {/* Clickable Label to toggle Saldo vs Gastado */}
        <button
          type="button"
          onClick={() => setActiveView((prev) => (prev === 'available' ? 'spent' : 'available'))}
          className="balance-hero-label-btn"
          title="Toca para cambiar entre Saldo y Gastado"
        >
          <span>{labelTitle}</span>
          <span className="balance-hero-label-switch-hint">⇄</span>
        </button>

        <div className="balance-hero-amount">
          <span
            key={isHidden ? 'masked' : `amount-${activeView}-${currentCard.id}`}
            className="balance-hero-amount-val"
          >
            {isHidden ? (
              <span className="balance-hero-masked">$ ••••••••</span>
            ) : (
              <Money amountMinor={displayedAmount} currency={displayedCurrency} />
            )}
          </span>
        </div>

        {/* Solitary Translucent Frosted Glass Pill (Reference: ↗ 2.46% this month) */}
        <div className="balance-hero-actions-row">
          <button
            type="button"
            onClick={() => setActiveView((prev) => (prev === 'available' ? 'spent' : 'available'))}
            className="balance-hero-liquid-pill"
            title="Toca para alternar vista"
          >
            <span className="balance-liquid-pill-arrow" aria-hidden="true">
              {isShowingAvailable ? '↗' : '↘'}
            </span>
            <span>
              {isShowingAvailable
                ? `${daysRemaining} días restantes`
                : `${monthProgressPct}% del mes`}
            </span>
          </button>
        </div>

        {/* 3. The Liquid Glass Card Stack (Anchored at bottom, Apple Wallet style) */}
        <button
          type="button"
          onClick={() => {
            if (walletCards.length > 1) {
              const nextIndex = (activeCardIndex + 1) % walletCards.length;
              if (propActiveCardIndex === undefined) {
                setInternalCardIndex(nextIndex);
              }
              onCardChange?.(nextIndex, walletCards[nextIndex]!);
            }
          }}
          className="balance-card-stack"
          aria-label={`Cuenta activa: ${currentCard.displayName}. ${walletCards.length > 1 ? 'Toca para cambiar de cuenta' : ''}`}
          title={walletCards.length > 1 ? 'Toca para cambiar de cuenta' : currentCard.displayName}
        >
          {/* Layer 3: Top Back Ridge */}
          <div className="balance-card-layer balance-card-layer--back" aria-hidden="true" />

          {/* Layer 2: Mid-Back Ridge */}
          <div className="balance-card-layer balance-card-layer--mid-back" aria-hidden="true" />

          {/* Layer 1: Mid Ridge */}
          <div className="balance-card-layer balance-card-layer--mid" aria-hidden="true" />

          {/* Front Active Liquid Glass Card (Key remount triggers Apple shuffle animation) */}
          <div key={currentCard.id} className="balance-card-front balance-card-front--cycling">
            {/* Top / Mid Row: Dots, 4 digits (or name), real type (Ahorros / Crédito), and bank logo */}
            <div className="balance-card-mid-row">
              <div className="balance-card-digits-group">
                {currentCard.last4 ? (
                  <>
                    <span className="balance-card-bullet-group" aria-hidden="true">
                      <span className="balance-card-bullet" />
                      <span className="balance-card-bullet" />
                      <span className="balance-card-bullet" />
                      <span className="balance-card-bullet" />
                    </span>
                    <span className="balance-card-digits">{currentCard.last4}</span>
                  </>
                ) : null}
                <span className="balance-card-type-badge">{currentCard.typeLabel}</span>
                <ContactlessWaveIcon />
              </div>

              <div className="balance-card-brand-slot">
                <CardBrandMark brand={currentCard.brandBadge} />
              </div>
            </div>

            {/* Bottom Row: account name, individual card balance, and cycling counter */}
            <div className="balance-card-bottom-row">
              <div className="balance-card-account-meta">
                <span className="balance-card-acc-name">
                  {currentCard.displayName}
                </span>
                {currentCard.balanceMinor !== undefined && currentCard.id !== GENERAL_CARD_ID && (
                  <span className="balance-card-acc-balance">
                    {isHidden ? (
                      <span>$ ••••</span>
                    ) : (
                      <Money amountMinor={currentCard.balanceMinor} currency={currentCard.currency} />
                    )}
                  </span>
                )}
              </div>

              {walletCards.length > 1 && (
                <div className="balance-card-indicators-wrap">
                  <div className="balance-card-dots" aria-hidden="true">
                    {walletCards.map((c, i) => (
                      <span
                        key={c.id}
                        className={`balance-card-dot ${i === activeCardIndex % walletCards.length ? 'balance-card-dot--active' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="balance-card-cycle-pill">
                    {currentCard.id === GENERAL_CARD_ID ? t('wallet_general') : currentCard.bankName}{' '}
                    ({(activeCardIndex % walletCards.length) + 1} de {walletCards.length}) ⇄
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>
    </div>

    {/* 4. Standalone Companion Module: Month Pace & Rhythm */}
    <div className="balance-pace-capsule-standalone">
      <div className="balance-pace-row">
        <div className="balance-pace-stat">
          <span className="balance-pace-label">Ritmo de gasto</span>
          <span className="balance-pace-val">
            {isHidden ? (
              <span>$ ••••</span>
            ) : (
              <>
                <Money amountMinor={dailyPaceMinor} currency={currency} />
                <span className="balance-pace-unit"> / día</span>
              </>
            )}
          </span>
        </div>

        <div className="balance-pace-divider" aria-hidden="true" />

        <div className="balance-pace-stat balance-pace-stat--end">
          <span className="balance-pace-label">Avance del mes</span>
          <span className="balance-pace-val balance-pace-val--highlight">
            Día {currentDay} de {daysInMonth}
            <span className="balance-pace-remaining"> ({daysRemaining}d restantes)</span>
          </span>
        </div>
      </div>

      <div
        className="balance-pace-track"
        role="progressbar"
        aria-valuenow={monthProgressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso del mes: ${monthProgressPct}% transcurrido`}
      >
        <div
          className="balance-pace-fill"
          style={{ '--pace-progress': `${monthProgressPct}%` } as React.CSSProperties}
        />
      </div>
    </div>

    {/* 5. Menú Desplegable de Perfil (Apple Liquid Glass Popover centrado sin recortes) */}
    {isProfileOpen && (
      <div
        className="profile-overlay-root"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de perfil y cuenta"
      >
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
          {/* Header del Menú: Perfil + Botón de Cerrar */}
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-user">
              <div className="profile-dropdown-avatar">
                <span className="profile-dropdown-initial">{initial}</span>
              </div>
              <div className="profile-dropdown-meta">
                <span className="profile-dropdown-name">{name}</span>
                <span className="profile-dropdown-email">{userEmail}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="profile-dropdown-close-btn"
              aria-label={t('menu_close')}
              title={t('menu_close')}
            >
              <CategoryIcon name="X" size={16} />
            </button>
          </div>

          <div className="profile-dropdown-divider" />

          {/* Opciones Principales */}
          <div className="profile-dropdown-items-group">
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
          </div>

          <div className="profile-dropdown-divider" />

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
      </div>
    )}
  </>
);
}
