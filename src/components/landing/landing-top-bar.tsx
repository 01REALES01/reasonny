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
 * Floating top bar.
 *
 * Removed:
 *  - the infinite requestAnimationFrame loop that ran getBoundingClientRect()
 *    on every scroll frame;
 *  - the `isLightMode` machinery — it toggled a `--light` skin off the showcase
 *    section, but the showcase is dark and the bar hard-codes `--dark`, so the
 *    state, the listener and ~40 lines of CSS were dead.
 *
 * The only thing left to track is "has the page scrolled at all", and an
 * IntersectionObserver on a 1px sentinel does that with zero scroll handlers.
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

      <header
        className={`landing-top-bar landing-top-bar--dark ${isScrolled ? 'landing-top-bar--scrolled' : ''}`}
      >
        <div className="landing-top-bar-inner">
          <Link href="/" className="landing-brand" aria-label="Reasonny">
            <svg
              className="landing-brand-diamond"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="currentColor" />
            </svg>
            <span className="landing-brand-text">REASONNY</span>
          </Link>

          <nav className="landing-desktop-nav" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="landing-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="landing-top-actions">
            <Link href="/sign-in" className="landing-top-cta">
              <span>Probar ahora</span>
              <span aria-hidden="true"> →</span>
            </Link>

            <button
              type="button"
              className={`landing-mobile-toggle ${isMobileOpen ? 'landing-mobile-toggle--open' : ''}`}
              onClick={() => setIsMobileOpen((prev) => !prev)}
              aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isMobileOpen}
            >
              <span className="landing-hamburger-bar" />
              <span className="landing-hamburger-bar" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`landing-mobile-drawer ${isMobileOpen ? 'landing-mobile-drawer--open' : ''}`}
        aria-hidden={!isMobileOpen}
      >
        <div className="landing-mobile-drawer-content">
          <nav className="landing-mobile-nav" aria-label="Navegación móvil">
            {NAV_LINKS.map((link, idx) => (
              <a
                key={link.href}
                href={link.href}
                className="landing-mobile-nav-link"
                style={{ transitionDelay: isMobileOpen ? `${60 + idx * 40}ms` : '0ms' }}
                onClick={() => setIsMobileOpen(false)}
              >
                <span>{link.label}</span>
                <span className="landing-mobile-nav-arrow">→</span>
              </a>
            ))}
          </nav>

          <div className="landing-mobile-drawer-footer">
            <Link href="/sign-in" className="landing-mobile-cta-btn" onClick={() => setIsMobileOpen(false)}>
              Comenzar sin costo
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
