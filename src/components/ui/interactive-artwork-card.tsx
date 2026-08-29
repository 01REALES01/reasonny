'use client';

import Image from 'next/image';
import React, { useRef, useState } from 'react';

import { t } from '@/lib/i18n';

/**
 * Autonomous Kinetic 3D Artwork Card (Emil Kowalski / Apple Design).
 *
 * Runs a continuous autonomous fluid floating loop and specular gleam on GPU,
 * with additive subtle 3D perspective tilt on pointer interaction.
 */
export function InteractiveArtworkCard(): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  /**
   * The tilt is written straight to the node, not held in state.
   *
   * pointermove fires 60-120 times a second. Routing each one through
   * setState re-rendered this component - and the next/image inside it - at
   * that rate, on /sign-in, which is the one URL the P7 budget is asserted
   * against. The transform is pure presentation that no other element reads,
   * so React never needs to know about it.
   */
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt angles (max 6 degrees for luxury restraint)
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }

  function handlePointerLeave(): void {
    setIsInteracting(false);
    // Cleared, not left in place: the autonomous-float class returns on the
    // next render and an inline transform would sit on top of its animation.
    if (cardRef.current) cardRef.current.style.transform = '';
  }

  function handlePointerEnter(): void {
    setIsInteracting(true);
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={isInteracting ? '' : 'autonomous-float'}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          aspectRatio: '4 / 4.6',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-sunken)',
          border: '1px solid var(--glass-border)',
          boxShadow: isInteracting ? 'var(--glass-shadow-hover)' : 'var(--glass-shadow)',
          // Only transform is transitioned. box-shadow still CHANGES on
          // interaction, it just is not animated: animating a shadow forces the
          // browser to repaint a blurred region every frame on the main thread,
          // which is the rule CLAUDE.md states and which matters most here -
          // this card is the LCP element of /sign-in, the one page the
          // performance budget is measured on.
          transition: isInteracting
            ? 'transform 100ms cubic-bezier(0.23, 1, 0.32, 1)'
            : 'transform 700ms cubic-bezier(0.23, 1, 0.32, 1)',
          willChange: 'transform',
          cursor: 'grab',
          // pan-y, no none: la tarjeta ocupa casi todo el viewport en móvil,
          // y 'none' dejaba la página de acceso sin poder desplazarse con el
          // dedo desde encima del artwork. 'pan-y' conserva el scroll vertical
          // y sigue reservando el gesto horizontal para el tilt.
          touchAction: 'pan-y',
        }}
      >
        {/* Artwork Image with subtle high-contrast presentation */}
        <Image
          src="/intro-artwork.png"
          alt={t('artwork_alt')}
          fill
          priority
          sizes="(max-width: 900px) 100vw, 460px"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />

        {/* Autonomous Specular Gleam sweeping across the texture */}
        <div className="autonomous-gleam" />

        {/* Glass Inner Rim Highlight */}
        <div className="glass-rim" />
      </div>
    </div>
  );
}
