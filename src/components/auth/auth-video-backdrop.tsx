'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Fixed video backdrop for the sign-in screen.
 *
 * Unlike the landing (scrubbed by scroll), this one plays on its own — sign-in
 * is a single static screen, there is no scroll to drive it. Muted autoplay
 * loop, a poster so the first paint is never black, and it steps aside for
 * prefers-reduced-motion (poster only).
 */
export function AuthVideoBackdrop(): React.ReactElement {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.removeAttribute('autoplay');
      v.pause();
      return;
    }
    // React sets `muted` as an attribute, not the property — without this the
    // autoplay can be blocked as "not muted".
    void v.play().catch(() => {});
  }, []);

  return (
    <div className="auth-video" aria-hidden="true">
      <video
        ref={ref}
        className="auth-video-el"
        src="/videos/onboarding.mp4"
        poster="/images/onboarding-poster.jpeg"
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        tabIndex={-1}
      />
      <div className="auth-video-scrim" />
    </div>
  );
}
