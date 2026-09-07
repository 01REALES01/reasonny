'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Fixed cinematic backdrop, scrubbed by scroll.
 *
 * The scroll ↔ video coupling stays — it is the signature of the hero (the hand
 * raises the phone as you enter the page). What changed is everything that made
 * the old version jank on a phone:
 *
 *  - The scrub loop is GATED by an IntersectionObserver on #cinematic-track.
 *    While the hero is off-screen there is no scroll listener and no rAF at all.
 *  - Scroll fires a single COALESCED rAF (one getBoundingClientRect + one seek
 *    per frame at most), not a free-running requestAnimationFrame every frame
 *    for the life of the page.
 *  - `preload="metadata"`, not `auto` — the ~4 MB of video no longer competes
 *    with LCP. A poster paints the composition on the first frame.
 *  - No React state here and none in the sibling sections, so scrolling the
 *    hero no longer triggers component re-renders.
 *  - prefers-reduced-motion: no scrub, the poster/first frame stands.
 *
 * Both <video> elements stay mounted (opacity, never display:none) so WebKit
 * keeps the decode context and seeking stays instant.
 */
export function CinematicVideoCanvas(): React.ReactElement {
  const desktopRef = useRef<HTMLVideoElement | null>(null);
  const mobileRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const track = document.getElementById('cinematic-track');
    if (!track) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Never call play(): the video must only ever move under the scroll. It is
    // paused for its whole life and we drive currentTime by hand. (A muted
    // play()/pause() "prime" was here to unlock iOS seeking — it also caused a
    // visible blip of playback when the page sat still, which is exactly what
    // must not happen. Modern Safari seeks a muted inline video fine without it;
    // if the very first pre-interaction seek is ignored, the first scroll fixes
    // it.)
    for (const v of [desktopRef.current, mobileRef.current]) {
      if (!v) continue;
      v.muted = true;
      v.playsInline = true;
      v.pause();
    }

    if (prefersReducedMotion) return;

    function activeVideo(): HTMLVideoElement | null {
      return window.innerWidth <= 768 ? mobileRef.current : desktopRef.current;
    }

    function seek(video: HTMLVideoElement | null, progress: number): void {
      if (!video || !video.duration || Number.isNaN(video.duration)) return;
      const target = Math.min(Math.max(progress * video.duration, 0), video.duration - 0.05);
      if (Math.abs(video.currentTime - target) < 0.02) return;
      const withFastSeek = video as HTMLVideoElement & { fastSeek?: (t: number) => void };
      if (typeof withFastSeek.fastSeek === 'function') withFastSeek.fastSeek(target);
      else video.currentTime = target;
    }

    let frame = 0;
    function update(): void {
      frame = 0;
      const rect = track!.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
      seek(activeVideo(), progress);
    }
    function onScroll(): void {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    }

    let listening = false;
    function startListening(): void {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }
    function stopListening(): void {
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    // Only run the scrub while the cinematic track is anywhere near the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) startListening();
        else stopListening();
      },
      { rootMargin: '200px' },
    );
    io.observe(track);

    return () => {
      io.disconnect();
      stopListening();
    };
  }, []);

  return (
    <div className="cinematic-video-canvas" aria-hidden="true">
      <video
        ref={desktopRef}
        className="cinematic-video-layer cinematic-video-desktop"
        src="/videos/landscape_desktop.mp4"
        poster="/images/hero-desktop.jpeg"
        muted
        playsInline
        preload="metadata"
        tabIndex={-1}
      />
      <video
        ref={mobileRef}
        className="cinematic-video-layer cinematic-video-mobile"
        src="/videos/hero-mobile.mp4"
        poster="/images/hero-mobile.jpeg"
        muted
        playsInline
        preload="metadata"
        tabIndex={-1}
      />
    </div>
  );
}
