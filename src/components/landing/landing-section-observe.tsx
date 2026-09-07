import React from 'react';

/**
 * Chapter 02 — "Observe".
 *
 * Was a client component running an infinite requestAnimationFrame loop that
 * called getBoundingClientRect() and setState() on every frame to nudge the
 * headline a few pixels (a 60/s React re-render for a decorative parallax).
 * The parallax added nothing a reader notices and cost a frame budget on
 * exactly the surface — scroll — where it hurts. It is now a static section.
 */
export function LandingSectionObserve(): React.ReactElement {
  return (
    <section id="chapter-observe" className="landing-chapter landing-chapter--observe" aria-label="02 Observe">
      <div className="landing-kinetic-stage">
        <div className="landing-kinetic-hero-row">
          <h2 className="landing-kinetic-headline">
            Tu dinero tiene un <span className="landing-thesis-gold-highlight">ritmo propio.</span>
          </h2>
        </div>

        <div className="landing-kinetic-caption">
          <p>
            Reasonny observa ese ritmo: agrupa tus gastos por periodo y te muestra
            cuándo se aceleran, antes de que el mes cierre.
          </p>
        </div>
      </div>
    </section>
  );
}
