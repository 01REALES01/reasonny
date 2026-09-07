'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

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
    <nav className="phone-dock" aria-label="Navegación principal">
      {/* 1. Dashboard / Resumen */}
      <Link
        href="/dashboard"
        className={`phone-dock-item${
          pathname === '/dashboard' ? ' phone-dock-item--active' : ''
        }`}
        aria-label="Inicio"
        aria-current={pathname === '/dashboard' ? 'page' : undefined}
      >
        <CategoryIcon name="LayoutGrid" size={20} />
      </Link>

      {/* 2. Nuevo Registro (+) */}
      <Link
        href="/nuevo"
        className={`phone-dock-item phone-dock-item--highlight${
          pathname === '/nuevo' ? ' phone-dock-item--active' : ''
        }`}
        aria-label="Registrar"
        aria-current={pathname === '/nuevo' ? 'page' : undefined}
      >
        <CategoryIcon name="Plus" size={22} />
      </Link>

      {/* 3. Exportar CSV */}
      <a
        href="/api/v1/export"
        download
        className="phone-dock-item"
        aria-label="Exportar datos CSV"
        title="Exportar CSV"
      >
        <CategoryIcon name="Download" size={19} />
      </a>
    </nav>
  );
}

