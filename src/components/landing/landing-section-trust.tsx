import Link from 'next/link';
import React from 'react';

export function LandingSectionTrust(): React.ReactElement {
  return (
    <section id="chapter-trust" className="landing-chapter landing-chapter--trust" aria-label="04 Trust">
      <div className="landing-horizon-stage" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 className="landing-horizon-headline" style={{ textAlign: 'center' }}>
          Comprende exactamente<br />
          <span style={{ color: 'var(--landing-champagne-gold)' }}>dónde estás.</span>
        </h2>

        <p className="landing-word-subhead" style={{ margin: '0 auto 36px auto', maxWidth: '580px' }}>
          Sin pantallas saturadas de números. Solo la certeza de saber exactamente cuánto puedes gastar hoy sin tocar tus metas de mañana.
        </p>

        <Link href="/sign-in" className="landing-gold-cta-btn">
          <span>Comenzar ahora</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {/* Seamless Diffuse Transition Mist into the rest of the page */}
      <div className="landing-diffuse-transition" aria-hidden="true" />
    </section>
  );
}
