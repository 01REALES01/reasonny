'use client';

import React, { useEffect, useRef, useState } from 'react';

const TOTAL_MOBILE_FRAMES = 60;

/**
 * Cinematic backdrop scrubber.
 *
 * Architecture:
 * - Mobile / Safari PWA:
 *   Uses an optimized Canvas Image Sequence (60 intra-frames).
 *   On iOS Safari and PWA standalone mode, scrubbing <video> via `currentTime`
 *   frequently causes WebKit to suspend decoding, stay in permanent seeking state,
 *   or flash black. An image sequence rendered to <canvas> provides 100% reliable,
 *   instant 60fps/120fps hardware-accelerated scrubbing without video decoder overhead.
 * - Desktop:
 *   Uses centered intra-frame landscape video, scrubbed on GPU with RAF throttling.
 */
export function CinematicVideoCanvas(): React.ReactElement {
  const desktopVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * Which layer is live. null until the browser has been asked, so the setup
   * effect below does not run once against a guess and then again for real.
   *
   * It used to be a plain `const isMobile = window.innerWidth <= 768` read once
   * inside the setup effect, which never re-ran. Rotating a phone past the
   * breakpoint left the desktop <video> showing with nothing scrubbing it -
   * frozen on its first frame for the rest of the visit.
   */
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const apply = (): void => setIsMobile(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (isMobile === null) return;
    const track = document.getElementById('cinematic-track');
    const canvas = canvasRef.current;
    if (!track) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desktopVideo = desktopVideoRef.current;

    // ------------------------------------------------------------------
    // MOBILE: Canvas Frame Sequence
    // ------------------------------------------------------------------
    let mobileFrames: HTMLImageElement[] = [];
    let currentFrameIndex = 0;

    function renderMobileFrame(index: number): void {
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const img = mobileFrames[index];
      if (!img || !img.complete || img.naturalWidth === 0) {
        // Fallback to nearest loaded frame, never flashing back to frame 0
        let found: HTMLImageElement | null = null;
        for (let offset = 1; offset < TOTAL_MOBILE_FRAMES; offset++) {
          const prev = mobileFrames[index - offset];
          if (prev && prev.complete && prev.naturalWidth > 0) {
            found = prev;
            break;
          }
          const next = mobileFrames[index + offset];
          if (next && next.complete && next.naturalWidth > 0) {
            found = next;
            break;
          }
        }
        const fallback = found || mobileFrames[0];
        if (fallback && fallback.complete && fallback.naturalWidth > 0) {
          drawCover(ctx, fallback, canvas.width, canvas.height);
        }
        return;
      }

      currentFrameIndex = index;
      drawCover(ctx, img, canvas.width, canvas.height);
    }

    function drawCover(
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      cw: number,
      ch: number,
    ): void {
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = cw / ch;
      let rw = cw;
      let rh = ch;
      let x = 0;
      let y = 0;

      if (canvasRatio > imgRatio) {
        rw = cw;
        rh = cw / imgRatio;
        x = 0;
        y = (ch - rh) / 2;
      } else {
        rw = ch * imgRatio;
        rh = ch;
        x = (cw - rw) / 2;
        y = 0;
      }

      ctx.drawImage(img, x, y, rw, rh);
    }

    function resizeCanvas(): void {
      if (!canvas || !isMobile) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      renderMobileFrame(currentFrameIndex);
    }

    if (isMobile && canvas) {
      // 1. Initialize frame array
      mobileFrames = new Array(TOTAL_MOBILE_FRAMES);

      // 2. Load frame 0 immediately for instant paint
      const frame0 = new Image();
      frame0.src = '/frames/mobile/frame_001.jpg';
      frame0.onload = () => {
        resizeCanvas();
      };
      mobileFrames[0] = frame0;

      // 3. Preload all remaining frames in background
      for (let i = 1; i < TOTAL_MOBILE_FRAMES; i++) {
        const frameImg = new Image();
        const frameNum = String(i + 1).padStart(3, '0');
        frameImg.src = `/frames/mobile/frame_${frameNum}.jpg`;
        frameImg.onload = () => {
          if (currentFrameIndex === i) {
            renderMobileFrame(i);
          }
        };
        mobileFrames[i] = frameImg;
      }

      resizeCanvas();
    }

    // ------------------------------------------------------------------
    // DESKTOP: Centered Intra-Frame Video
    // ------------------------------------------------------------------
    let pendingDesktopTarget: number | null = null;

    if (!isMobile && desktopVideo) {
      desktopVideo.muted = true;
      desktopVideo.playsInline = true;
      desktopVideo.pause();
    }

    function performDesktopSeek(target: number): void {
      if (!desktopVideo) return;
      if (desktopVideo.seeking) {
        pendingDesktopTarget = target;
        return;
      }
      if ('fastSeek' in desktopVideo && typeof desktopVideo.fastSeek === 'function') {
        desktopVideo.fastSeek(target);
      } else {
        desktopVideo.currentTime = target;
      }
    }

    function onDesktopSeeked(): void {
      if (pendingDesktopTarget !== null) {
        const next = pendingDesktopTarget;
        pendingDesktopTarget = null;
        if (desktopVideo && Math.abs(desktopVideo.currentTime - next) >= 0.015) {
          performDesktopSeek(next);
        }
      }
    }

    if (!isMobile && desktopVideo) {
      desktopVideo.addEventListener('seeked', onDesktopSeeked);
    }

    function applyDesktopProgress(progress: number): void {
      if (!desktopVideo || !desktopVideo.duration || Number.isNaN(desktopVideo.duration)) {
        return;
      }
      const target = Math.min(
        Math.max(progress * desktopVideo.duration, 0),
        Math.max(0, desktopVideo.duration - 0.04),
      );
      if (Math.abs(desktopVideo.currentTime - target) < 0.015) return;
      performDesktopSeek(target);
    }

    // ------------------------------------------------------------------
    // Scroll Progress Handler (RAF-batched)
    // ------------------------------------------------------------------
    function update(): void {
      const rect = track!.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;

      if (isMobile) {
        const targetIndex = Math.min(
          Math.max(Math.floor(progress * (TOTAL_MOBILE_FRAMES - 1)), 0),
          TOTAL_MOBILE_FRAMES - 1,
        );
        renderMobileFrame(targetIndex);
      } else {
        applyDesktopProgress(progress);
      }
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

    function onResize(): void {
      if (isMobile) {
        resizeCanvas();
      }
      onScroll();
    }

    if (!prefersReducedMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('touchmove', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });

      if (isMobile) {
        update();
      } else if (desktopVideo) {
        if (desktopVideo.readyState >= 1) {
          update();
        } else {
          desktopVideo.addEventListener('loadedmetadata', update, { once: true });
        }
      }
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('resize', onResize);
      if (desktopVideo) {
        desktopVideo.removeEventListener('seeked', onDesktopSeeked);
      }
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  return (
    <div className="cinematic-video-canvas" aria-hidden="true">
      {/* Mobile Frame-Sequence Canvas (Zero WebKit video decoder issues) */}
      <canvas ref={canvasRef} className="cinematic-canvas-layer cinematic-canvas-mobile" />

      {/* Desktop Centered Video Layer */}
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
