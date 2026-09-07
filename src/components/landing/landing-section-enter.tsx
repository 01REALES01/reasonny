import Link from 'next/link';
import React from 'react';

export function LandingSectionEnter(): React.ReactElement {
  return (
    <section id="chapter-enter" className="landing-chapter" aria-label="01 Enter">
      <div className="landing-hero-stage">
        {/* Oversized display words flanking the phone in the scrubbed video.
            Decorative — the <h1> below carries the sentence for SEO and
            assistive tech. */}
        <div className="landing-hand-flank-row" aria-hidden="true">
          <span className="landing-word-giant landing-word-left">YOUR</span>
          <div className="landing-phone-spacer" />
          <span className="landing-word-giant landing-word-right">MONEY</span>
        </div>

        <div className="landing-hero-bottom">
          <h1 className="landing-word-center">Your money, made clear.</h1>

          <p className="landing-word-subhead">
            Un asistente financiero personal que registra tus gastos casi sin que
            muevas un dedo — y te explica cómo te estás comportando.
          </p>

          <Link href="/sign-in" className="landing-gold-cta-btn">
            <span>Pruébalo gratis</span>
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
