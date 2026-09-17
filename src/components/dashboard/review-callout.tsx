'use client';

import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';

interface ReviewCalloutProps {
  readonly uncategorizedCount: number;
}

/**
 * Triage Callout Card:
 *
 * Appears prominently when there are automated transactions waiting for human
 * confirmation (Level 2). Under Emil Kowalski's philosophy, this is the single
 * primary loop that trains the Rule Engine (Level 1) so future transactions
 * require 0 gestures.
 *
 * When the queue is 0, it vanishes quietly, leaving the dashboard clean and calm.
 */
export function ReviewCallout({
  uncategorizedCount,
}: ReviewCalloutProps): React.ReactElement | null {
  if (uncategorizedCount <= 0) {
    return null;
  }

  const label =
    uncategorizedCount === 1
      ? `1 ${t('review_callout_single')}`
      : `${uncategorizedCount} ${t('review_callout_plural')}`;

  return (
    <div className="review-callout">
      <div className="review-callout-content">
        <div className="review-callout-badge" aria-hidden="true">
          <CategoryIcon name="Zap" size={16} />
        </div>
        <div className="review-callout-text">
          <span className="review-callout-title">{label}</span>
          <span className="review-callout-desc">
            Asigna categoría en 1 toque para entrenar el auto-guardado
          </span>
        </div>
      </div>

      <Link
        href="/revisar"
        className="review-callout-btn"
        aria-label={`${t('review_callout_action')}: ${label}`}
      >
        <span>{t('review_callout_action')}</span>
        <CategoryIcon name="ArrowRight" size={14} />
      </Link>
    </div>
  );
}
