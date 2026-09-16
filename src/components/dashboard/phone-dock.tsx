'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';

/**
 * Floating Glass Capsule Dock:
 * - Positioned fixed at bottom center with safe margins.
 * - Frosted glass with champagne border and high optical blur.
 * - 3 clear, distinct actions:
 *   1. Inicio (/dashboard)
 *   2. Nuevo Registro (+) (/nuevo)
 *   3. Exportar CSV (/api/v1/export)
 */
export function PhoneDock(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav className="phone-dock" aria-label={t('nav_main')}>
      {/* 1. Dashboard / Resumen */}
      <Link
        href="/dashboard"
        className={`phone-dock-item${
          pathname === '/dashboard' ? ' phone-dock-item--active' : ''
        }`}
        aria-label={t('nav_home')}
        aria-current={pathname === '/dashboard' ? 'page' : undefined}
      >
        <CategoryIcon name="LayoutGrid" size={20} />
      </Link>

      {/* 2. El mes: totales, distribución por categoría e histórico */}
      <Link
        href="/mes"
        className={`phone-dock-item${pathname === '/mes' ? ' phone-dock-item--active' : ''}`}
        aria-label={t('nav_month')}
        aria-current={pathname === '/mes' ? 'page' : undefined}
      >
        <CategoryIcon name="PieChart" size={19} />
      </Link>

      {/* 3. Nuevo Registro (+) */}
      <Link
        href="/nuevo"
        className={`phone-dock-item phone-dock-item--highlight${
          pathname === '/nuevo' ? ' phone-dock-item--active' : ''
        }`}
        aria-label={t('nav_new')}
        aria-current={pathname === '/nuevo' ? 'page' : undefined}
      >
        <CategoryIcon name="Plus" size={22} />
      </Link>

      {/* 3. Perfil */}
      <Link
        href="/perfil"
        className={`phone-dock-item${
          pathname === '/perfil' ? ' phone-dock-item--active' : ''
        }`}
        aria-label={t('nav_profile')}
        aria-current={pathname === '/perfil' ? 'page' : undefined}
      >
        <CategoryIcon name="Sliders" size={19} />
      </Link>
    </nav>
  );
}

