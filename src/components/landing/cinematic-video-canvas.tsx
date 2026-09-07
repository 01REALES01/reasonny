'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Fixed cinematic backdrop, scrubbed smoothly by scroll.
 *
 * Designed for 60fps frame-accurate scrubbing on both desktop and mobile:
 *  - Both videos are encoded All-Intra (every frame is a keyframe), enabling
 *    sub-millisecond seek without GOP decode lag.
 *  - Preload="auto" ensures mobile Safari buffers frames immediately.
 *  - Explicit metadata listener ensures scrub works from the very first frame.
 *  - Touch and scroll events are listened passively without locking the main thread.
 *  - Zero React re-renders on scroll; currentTime is driven directly on the DOM element.
 */
export function CinematicVideoCanvas(): React.ReactElement {
  const desktopRef = useRef<HTMLVideoElement | null>(null);
  const mobileRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const track = document.getElementById('cinematic-track');
    if (!track) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Keep videos muted and paused: currentTime is driven exclusively by scroll.
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
      if (!video) return;
      if (!video.duration || Number.isNaN(video.duration) || video.duration <= 0) {
        const onLoaded = () => {
          seek(video, progress);
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        return;
      }
      const target = Math.min(Math.max(progress * video.duration, 0), Math.max(0, video.duration - 0.04));
      if (Math.abs(video.currentTime - target) < 0.015) return;
      video.currentTime = target;
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
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    }

    let listening = false;
    function startListening(): void {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('touchmove', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }

    function stopListening(): void {
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    // Initial seek to ensure frame 0 is rendered immediately
    update();

    // Observe track visibility to pause scroll listener when far out of view
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startListening();
        } else {
          stopListening();
        }
      },
      { rootMargin: '300px' },
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
        preload="auto"
        tabIndex={-1}
      />
      <video
        ref={mobileRef}
        className="cinematic-video-layer cinematic-video-mobile"
        src="/videos/hero-mobile.mp4"
        poster="/images/hero-mobile.jpeg"
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </div>
  );
}
