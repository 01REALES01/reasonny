'use client';

import React, { useEffect, useRef, useState } from 'react';

const STATEMENT_WORDS = [
  'El',
  'dinero',
  'no',
  'es',
  'estático.',
  'Tu',
  'claridad',
  'tampoco.',
];

/**
 * Chapter 03 — "Understand".
 *
 * The word-by-word reveal stays (it is the one immersive beat worth keeping),
 * but it no longer runs a per-frame rAF loop that setState'd the scroll
 * progress 60 times a second. An IntersectionObserver fires it ONCE when the
 * block enters, then disconnects. The words are fully legible with no JS and
 * under prefers-reduced-motion — the effect only animates their entrance, it
 * never gates the content behind scroll position (DESIGN_SYSTEM.md §5.4).
 */
export function LandingSectionUnderstand(): React.ReactElement {
  const sectionRef = useRef<HTMLElement | null>(null);
  // `armed` is only true once JS has run: without it the words render at full
  // opacity (no-JS readers get the content, not a dim placeholder).
  const [armed, setArmed] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    setArmed(true);

    if (!('IntersectionObserver' in window)) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="chapter-understand"
      ref={sectionRef}
      className={`landing-chapter landing-chapter--understand ${armed ? 'is-armed' : ''} ${revealed ? 'is-revealed' : ''}`}
      aria-label="03 Understand"
    >
      <div className="landing-reveal-stage">
        <p className="landing-reveal-statement">
          {STATEMENT_WORDS.map((word, i) => (
            <React.Fragment key={`${word}-${i}`}>
              {i > 0 ? ' ' : null}
              <span className="landing-reveal-word" style={{ transitionDelay: `${i * 55}ms` }}>
                {word}
              </span>
            </React.Fragment>
          ))}
        </p>

        <p className="landing-reveal-subhead">
          Reasonny aprende el comportamiento de tu capital antes de que el mes cierre.
          Una interfaz pensada para darte dirección, no culpa.
        </p>
      </div>
    </section>
  );
}
