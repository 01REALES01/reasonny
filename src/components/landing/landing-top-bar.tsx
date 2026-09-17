'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';

const NAV_LINKS = [
  { label: 'Filosofía', href: '#chapter-observe' },
  { label: 'Sin fricción', href: '#features-zero-touch' },
  { label: 'Tu tarjeta', href: '#features-card' },
  { label: 'Privacidad', href: '#features-security' },
  { label: 'Insights', href: '#features-telemetry' },
];

/**
 * Adaptive Navigation for Reasonny Landing:
 *
 *  - Desktop (> 768px): Centered luxury glass capsule pinned at the top.
 *  - Mobile (<= 768px): Clean minimal logo at the top, and a floating glass
 *    capsule dock at the bottom with quick menu trigger and thumb-friendly CTA.
 */
export function LandingTopBar(): React.ReactElement {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsScrolled(!entry.isIntersecting);
      },
      { rootMargin: '-40px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" style={{ position: 'absolute', top: 0, height: 1, width: 1 }} />

      {/* Top Header: Full capsule on Desktop, ultra-minimal brand-only on Mobile */}
      <header
        className={`landing-top-bar landing-top-bar--dark ${isScrolled ? 'landing-top-bar--scrolled' : ''}`}
      >
        <div className="landing-top-bar-inner">
          <Link href="/" className="landing-brand" aria-label="Reasonny">
            <svg
              className="landing-brand-diamond"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M6 4C6 3.45 6.45 3 7 3H8.5C9.05 3 9.5 3.45 9.5 4V20C9.5 20.55 9.05 21 8.5 21H7C6.45 21 6 20.55 6 20V4Z" />
              <path fillRule="evenodd" clipRule="evenodd" d="M9.5 3H14.2C17.2 3 19.5 5.1 19.5 8C19.5 10.9 17.2 13 14.2 13H9.5V3ZM12 5.5H14C15.4 5.5 16.8 6.5 16.8 8C16.8 9.5 15.4 10.5 14 10.5H12V5.5Z" />
              <path d="M12.8 11.8L17.8 19.8C18.1 20.3 18.8 20.4 19.3 20.1C19.7 19.8 19.9 19.1 19.6 18.6L14.8 11.2C14.1 11.3 13.4 11.5 12.8 11.8Z" />
            </svg>
            <span className="landing-brand-text">REASONNY</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="landing-desktop-nav" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="landing-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Top CTA */}
          <div className="landing-top-actions">
            <Link href="/sign-in" className="landing-top-cta">
              <span>Probar ahora</span>
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Dock (Phone-friendly, avoids notch and puts CTA at thumb height) */}
      <aside className="landing-mobile-bottom-dock" aria-label="Navegación móvil inferior">
        <button
          type="button"
          className="landing-mobile-dock-btn landing-mobile-dock-menu"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
          aria-expanded={isMobileOpen}
        >
          <svg
            className="landing-dock-menu-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isMobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="8" x2="20" y2="8" />
                <line x1="4" y1="16" x2="20" y2="16" />
              </>
            )}
          </svg>
          <span>{isMobileOpen ? 'Cerrar' : 'Menú'}</span>
        </button>

        <Link href="/sign-in" className="landing-mobile-dock-cta">
          <span>Probar ahora</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`landing-mobile-drawer ${isMobileOpen ? 'landing-mobile-drawer--open' : ''}`}
        aria-hidden={!isMobileOpen}
      >
        <div className="landing-mobile-drawer-content">
          <div className="landing-mobile-drawer-header">
            <span className="landing-drawer-title">Navegación</span>
            <button
              type="button"
              className="landing-drawer-close-btn"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Cerrar navegación"
            >
              ✕
            </button>
          </div>

          <nav className="landing-mobile-nav" aria-label="Navegación móvil">
            {NAV_LINKS.map((link, idx) => (
              <a
                key={link.href}
                href={link.href}
                className="landing-mobile-nav-link"
                style={{ transitionDelay: isMobileOpen ? `${40 + idx * 30}ms` : '0ms' }}
                onClick={() => setIsMobileOpen(false)}
              >
                <span>{link.label}</span>
                <span className="landing-mobile-nav-arrow">→</span>
              </a>
            ))}
          </nav>

          <div className="landing-mobile-drawer-footer">
            <Link
              href="/sign-in"
              className="landing-mobile-cta-btn"
              onClick={() => setIsMobileOpen(false)}
            >
              Comenzar sin costo →
            </Link>
            <div className="landing-mobile-trust-note">
              <span>🔒 Sincronización de solo lectura</span>
              <span>·</span>
              <span>Sin publicidad</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
