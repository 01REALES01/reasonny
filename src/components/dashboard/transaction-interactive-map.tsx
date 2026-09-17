'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Point } from '@/core/geo';

interface TransactionInteractiveMapProps {
  readonly point: Point;
}

/**
 * Interactive map for the transaction detail view powered by Leaflet.
 *
 * Dynamically imported to ensure 0 KB of Leaflet is loaded on dashboard or
 * quick-add pages. Uses CartoDB Dark Matter tiles with Retina (@2x) support
 * to seamlessly match Reasonny's dark luxury aesthetic.
 */
export function TransactionInteractiveMap({
  point,
}: TransactionInteractiveMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent re-initialization if container already has a Leaflet instance
    const map = L.map(containerRef.current, {
      center: [point.latitude, point.longitude],
      zoom: 16,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false,
      scrollWheelZoom: false, // Prevents stealing page scroll
      attributionControl: false, // Rendered cleanly in the outer card footer
    });

    // Zoom control at bottom-left so it doesn't overlap the "Abrir en Maps" button at bottom-right
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    const isRetina = typeof window !== 'undefined' && window.devicePixelRatio > 1;
    const retinaSuffix = isRetina ? '@2x' : '';

    if (cartoKey) {
      L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}${retinaSuffix}.png?api_key=${encodeURIComponent(cartoKey)}`,
        {
          subdomains: 'abcd',
          maxZoom: 19,
        },
      ).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        maxZoom: 19,
        className: 'tx-map-dark-tiles',
      }).addTo(map);
    }

    const pinIcon = L.divIcon({
      className: 'tx-leaflet-pin-wrapper',
      html: '<div class="tx-leaflet-pin" aria-hidden="true"><div class="tx-leaflet-pin-core"></div><div class="tx-leaflet-pin-pulse"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([point.latitude, point.longitude], { icon: pinIcon }).addTo(map);

    // Invalidate size after initial layout render to ensure all tiles render seamlessly
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      map.remove();
    };
  }, [point.latitude, point.longitude]);

  return <div ref={containerRef} className="tx-interactive-map" aria-hidden="true" />;
}
