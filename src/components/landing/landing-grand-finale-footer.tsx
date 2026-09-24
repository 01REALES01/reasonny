import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export function LandingGrandFinaleFooter(): React.ReactElement {
  return (
    <footer id="grand-finale" className="landing-grand-finale" aria-label="Cierre y pie de página">
      <div className="landing-finale-top-blend" aria-hidden="true" />

      {/* Panoramic horizon. Art-directed: a portrait crop on phones (from
          footer_mobile_re), the wide shot on larger screens. Each is served
          only at its breakpoint via CSS. */}
      <div className="landing-finale-bg-wrap" aria-hidden="true">
        <Image
          src="/images/footer-mobile.jpeg"
          alt=""
          fill
          sizes="100vw"
          className="landing-finale-bg-img landing-finale-bg-img--mobile"
          priority={false}
        />
        <Image
          src="/images/footer.jpeg"
          alt=""
          fill
          sizes="100vw"
          className="landing-finale-bg-img landing-finale-bg-img--desktop"
          priority={false}
          quality={75}
        />
        <div className="landing-finale-vignette" />
      </div>

      <div className="landing-finale-stage">
        <div className="landing-finale-glass-card">
          <div className="landing-finale-emblem-wrap">
            <svg
              className="landing-finale-emblem"
              viewBox="0 0 24 24"
              fill="var(--landing-champagne-gold)"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M6 4C6 3.45 6.45 3 7 3H8.5C9.05 3 9.5 3.45 9.5 4V20C9.5 20.55 9.05 21 8.5 21H7C6.45 21 6 20.55 6 20V4Z" />
              <path fillRule="evenodd" clipRule="evenodd" d="M9.5 3H14.2C17.2 3 19.5 5.1 19.5 8C19.5 10.9 17.2 13 14.2 13H9.5V3ZM12 5.5H14C15.4 5.5 16.8 6.5 16.8 8C16.8 9.5 15.4 10.5 14 10.5H12V5.5Z" />
              <path d="M12.8 11.8L17.8 19.8C18.1 20.3 18.8 20.4 19.3 20.1C19.7 19.8 19.9 19.1 19.6 18.6L14.8 11.2C14.1 11.3 13.4 11.5 12.8 11.8Z" />
            </svg>
            <span className="landing-finale-emblem-text">REASONNY</span>
          </div>

          <h2 className="landing-finale-title">
            Que registrar un gasto <br />
            <span className="landing-finale-gold-accent">deje de ser una tarea.</span>
          </h2>

          <p className="landing-finale-subtitle">
            Empieza a registrar tus gastos con casi cero esfuerzo y deja que el sistema
            te diga lo que importa, sin que tengas que buscarlo.
          </p>

          <div className="landing-finale-cta-group">
            <Link href="/sign-in" className="landing-gold-cta-btn landing-finale-cta-btn">
              <span>Crear cuenta con tu correo</span>
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div>

        <div className="landing-finale-nav-grid">
          <div className="landing-finale-nav-col">
            <h4 className="landing-finale-nav-heading">Cómo funciona</h4>
            <a href="#features-zero-touch" className="landing-finale-nav-item">Registro sin esfuerzo</a>
            <a href="#features-telegram" className="landing-finale-nav-item">Notificaciones en Telegram</a>
            <a href="#features-vision" className="landing-finale-nav-item">Conciliación por extracto</a>
            <a href="#features-faq" className="landing-finale-nav-item">Preguntas frecuentes</a>
            <a href="#features-telemetry" className="landing-finale-nav-item">Insights sobre tu comportamiento</a>
          </div>

          <div className="landing-finale-nav-col">
            <h4 className="landing-finale-nav-heading">Privacidad</h4>
            <span className="landing-finale-nav-item">Aislamiento por usuario</span>
            <span className="landing-finale-nav-item">Sin venta ni cesión de datos</span>
            <span className="landing-finale-nav-item">Cifrado en reposo</span>
            <span className="landing-finale-nav-item">Acceso a tu banco de solo lectura</span>
          </div>

          <div className="landing-finale-nav-col">
            <h4 className="landing-finale-nav-heading">Acceso</h4>
            <Link href="/sign-in" className="landing-finale-nav-item">Crear cuenta / iniciar sesión</Link>
            <Link href="/sign-in" className="landing-finale-nav-item">Entrar al panel</Link>
          </div>
        </div>

        <div className="landing-finale-bottom-bar">
          <div className="landing-finale-copy">
            <span>© {new Date().getFullYear()} Reasonny. Todos los derechos reservados.</span>
            <span className="landing-finale-copy-divider">·</span>
            <span>Hecho por Jean Paul Reales.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
