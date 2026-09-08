'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Fixed cinematic backdrop, scrubbed smoothly by scroll.
 *
 * Implements a double-buffered Canvas rendering pipeline for mobile:
 *  - On iOS Safari, setting `video.currentTime` on a visible <video> during scroll
 *    causes WebKit to clear the display surface to black while seeking.
 *  - By drawing decoded frames into a <canvas>, the canvas retains the last valid frame
 *    continuously, completely eliminating any black flashes or tearing.
 *  - Seeking is serialized via an `isSeeking` mutex with `pendingProgress` to prevent
 *    seek abort loops in the browser hardware decoder.
 *  - On desktop, the centered intra-frame video scrubs directly on the GPU.
 */
export function CinematicVideoCanvas(): React.ReactElement {
  const desktopVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const track = document.getElementById('cinematic-track');
    const canvas = canvasRef.current;
    if (!track) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 768;
    const video = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });

    // Paint mobile poster to canvas immediately on mount so frame 0 is instant
    if (canvas && ctx && isMobile) {
      const poster = new Image();
      poster.src = '/images/hero-mobile.jpeg';
      poster.onload = () => {
        canvas.width = poster.naturalWidth || 720;
        canvas.height = poster.naturalHeight || 1280;
        ctx.drawImage(poster, 0, 0, canvas.width, canvas.height);
      };
    }

    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.pause();

    let isSeeking = false;
    let pendingProgress: number | null = null;

    function renderToCanvas(): void {
      if (!isMobile || !canvas || !ctx || !video) return;
      if (video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }

    function onSeeked(): void {
      isSeeking = false;
      renderToCanvas();

      if (pendingProgress !== null) {
        const next = pendingProgress;
        pendingProgress = null;
        applyProgress(next);
      }
    }

    video.addEventListener('seeked', onSeeked);

    function applyProgress(progress: number): void {
      if (!video || !video.duration || Number.isNaN(video.duration) || video.duration <= 0) {
        return;
      }
      const target = Math.min(Math.max(progress * video.duration, 0), Math.max(0, video.duration - 0.04));
      if (Math.abs(video.currentTime - target) < 0.015) return;

      if (isSeeking || video.seeking) {
        pendingProgress = progress;
        return;
      }

      isSeeking = true;
      video.currentTime = target;
    }

    function update(): void {
      const rect = track!.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
      applyProgress(progress);
    }

    let rafId = 0;
    function onScroll(): void {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(() => {
          rafId = 0;
          update();
        });
      }
    }

    if (!prefersReducedMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('touchmove', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });

      if (video.readyState >= 1) {
        update();
      } else {
        video.addEventListener('loadedmetadata', update, { once: true });
      }
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('resize', onScroll);
      video.removeEventListener('seeked', onSeeked);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="cinematic-video-canvas" aria-hidden="true">
      {/* Mobile Canvas Viewport: double-buffered to guarantee zero black frame flicker */}
      <canvas ref={canvasRef} className="cinematic-canvas-layer cinematic-canvas-mobile" />

      {/* Hidden Mobile Video Decoder: kept in viewport to preserve WebKit hardware decoding */}
      <video
        ref={mobileVideoRef}
        className="cinematic-video-layer cinematic-video-mobile-source"
        src="/videos/hero-mobile.mp4"
        poster="/images/hero-mobile.jpeg"
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />

      {/* Desktop Video Layer */}
      <video
        ref={desktopVideoRef}
        className="cinematic-video-layer cinematic-video-desktop"
        src="/videos/landscape_desktop.mp4"
        poster="/images/hero-desktop.jpeg"
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </div>
  );
}
