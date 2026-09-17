'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { HOME_RADIUS_M, isWithin, type Point } from '@/core/geo';
import { t } from '@/lib/i18n';

interface TransactionMapProps {
  readonly point: Point;
  readonly accuracyM: number | null;
  /** 'device_pwa' means "recorded here"; 'shortcut' means "paid here". */
  readonly source: string | null;
  /** The profile's saved home, when it has one. */
  readonly home: Point | null;
}

const DynamicInteractiveMap = dynamic(
  () =>
    import('./transaction-interactive-map').then(
      (mod) => mod.TransactionInteractiveMap,
    ),
  {
    ssr: false,
    loading: () => <div className="tx-map-skeleton" aria-hidden="true" />,
  },
);

/**
 * The map on the transaction detail: an interactive, dark-themed map.
 *
 * Loaded dynamically so Leaflet (~42 KB gz) is only ever downloaded when
 * viewing an individual transaction with coordinates. Zero impact on LCP or
 * INP of the dashboard, login or quick-add pages.
 */
export function TransactionMap({
  point,
  accuracyM,
  source,
  home,
}: TransactionMapProps): React.ReactElement {
  const atHome = home ? isWithin(point, home, HOME_RADIUS_M) : false;

  // A universal maps URL to jump into the native map app if needed
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;

  return (
    <section className="tx-map-card" aria-labelledby="tx-map-title">
      <div className="tx-map-head">
        <h2 id="tx-map-title" className="tx-map-title">
          {t('location_title')}
        </h2>
        {/* Only when a home is saved. With nothing to compare against, the
            honest answer is silence, not "away from home". */}
        {home && (
          <span className={`tx-map-badge${atHome ? ' tx-map-badge--home' : ''}`}>
            {atHome && <CategoryIcon name="Home" size={13} />}
            {atHome ? t('location_at_home') : t('location_away')}
          </span>
        )}
      </div>

      <div className="tx-map-frame">
        <DynamicInteractiveMap point={point} />

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-map-open"
          aria-label={t('location_open_maps')}
        >
          <CategoryIcon name="ArrowUpRight" size={13} />
          {t('location_open_maps')}
        </a>
      </div>

      <div className="tx-map-foot">
        <span className="tx-map-source">
          {source === 'shortcut' ? t('location_paid_here') : t('location_recorded_here')}
        </span>
        {/* Shown, not hidden: the reading is only as good as its radius, and a
            map that never admits its own error invites reading it as truth. */}
        {accuracyM !== null && (
          <span className="tx-map-accuracy">
            {t('location_accuracy_approx')} ±{accuracyM} m
          </span>
        )}
      </div>

      <div className="tx-map-attribution">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap
        </a>
        {' · '}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noopener noreferrer"
        >
          © CARTO
        </a>
      </div>
    </section>
  );
}

