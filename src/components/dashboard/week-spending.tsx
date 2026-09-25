'use client';

import React, { useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import type { WeekSpending } from '@/core/services/analytics.service';
import { formatDate, t } from '@/lib/i18n';

interface WeekSpendingCardProps {
  readonly week: WeekSpending;
  readonly monthExpenseMinor: bigint;
  readonly currency: string;
}

// A day with a small spend still gets a visible bar: next to a big day it would
// otherwise round to nothing and read as "spent nothing", which is false.
const MIN_BAR_SHARE = 0.06;

/**
 * The week at a glance with tactile day inspection:
 * - Tap any bar to reveal the exact expense of that day, comparison to week, and share.
 * - Tap again or tap close to return to the whole-week summary.
 * - Accessible keyboard navigation with aria-pressed.
 */
export function WeekSpendingCard({
  week,
  monthExpenseMinor,
  currency,
}: WeekSpendingCardProps): React.ReactElement {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const max = week.days.reduce(
    (top, d) => (d.totalExpenseMinor > top ? d.totalExpenseMinor : top),
    0n,
  );

  const selectedDay = selectedDayKey
    ? week.days.find((d) => d.day === selectedDayKey) ?? null
    : null;

  const isTodaySelected = selectedDay?.day === week.today;
  const isFutureSelected = Boolean(selectedDay && selectedDay.day > week.today);
  const selectedDateIso = selectedDay ? `${selectedDay.day}T12:00:00Z` : null;

  // Percentage of week spent on this selected day
  const pctOfWeek =
    selectedDay && week.weekExpenseMinor > 0n
      ? Math.round(
          (Number(selectedDay.totalExpenseMinor) / Number(week.weekExpenseMinor)) * 100,
        )
      : 0;

  const isPeakDay = Boolean(
    selectedDay && max > 0n && selectedDay.totalExpenseMinor === max,
  );

  return (
    <section className="week-card" aria-labelledby="week-card-title">
      <div className="week-card-head">
        <div className="week-card-title-group">
          <h2 id="week-card-title" className="fin-stat-label">
            {t('week_title')}
          </h2>
          <span className="week-card-sublabel">Toca una barra para ver su gasto</span>
        </div>
        <div className="week-card-total-group">
          <span className="week-card-total">
            <Money amountMinor={week.weekExpenseMinor} currency={currency} />
          </span>
          {typeof week.weekOverWeekDeltaPct === 'number' && (
            <span
              className={`week-card-delta-badge ${
                week.weekOverWeekDeltaPct > 0
                  ? 'week-card-delta-badge--up'
                  : week.weekOverWeekDeltaPct < 0
                  ? 'week-card-delta-badge--down'
                  : 'week-card-delta-badge--neutral'
              }`}
              title="Comparado con los mismos días de la semana anterior"
            >
              <span className="week-card-delta-arrow" aria-hidden="true">
                {week.weekOverWeekDeltaPct > 0 ? '↑' : week.weekOverWeekDeltaPct < 0 ? '↓' : '•'}
              </span>
              <span>
                {week.weekOverWeekDeltaPct > 0
                  ? `+${week.weekOverWeekDeltaPct}%`
                  : `${week.weekOverWeekDeltaPct}%`}
                {' vs sem. anterior'}
              </span>
            </span>
          )}
        </div>
      </div>

      <ol
        className={`week-bars${selectedDayKey ? ' week-bars--has-selection' : ''}`}
        aria-label="Gastos por día de la semana"
      >
        {week.days.map((d) => {
          // Read at midday UTC: the key is already the local day.
          const date = `${d.day}T12:00:00Z`;
          const share =
            d.totalExpenseMinor > 0n
              ? Math.max(MIN_BAR_SHARE, Number(d.totalExpenseMinor) / Number(max))
              : 0;
          const isSelected = d.day === selectedDayKey;
          const isToday = d.day === week.today;
          const isFuture = d.day > week.today;

          const stateClasses = [
            isToday ? 'week-bar--today' : '',
            isFuture ? 'week-bar--future' : '',
            isSelected ? 'week-bar--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const dayLabel = formatDate(date, 'UTC', 'es', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          });

          return (
            <li key={d.day} className="week-bar-item">
              <button
                type="button"
                onClick={() =>
                  setSelectedDayKey((prev) => (prev === d.day ? null : d.day))
                }
                className={`week-bar-btn ${stateClasses}`}
                aria-pressed={isSelected}
                aria-label={`Ver gasto de ${dayLabel}`}
              >
                <span className="week-bar-track" aria-hidden="true">
                  <span
                    className="week-bar-fill"
                    style={{ '--bar-share': share } as React.CSSProperties}
                  />
                </span>
                <span className="week-bar-day" aria-hidden="true">
                  {formatDate(date, 'UTC', 'es', { weekday: 'narrow' })}
                </span>
                <span className="week-bar-indicator" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>

      {/* Tactile Day Spending Inspector (Appears when any bar is clicked) */}
      {selectedDay && selectedDateIso ? (
        <div className="week-card-inspector" role="region" aria-live="polite">
          <div className="week-inspector-header">
            <div className="week-inspector-date-wrap">
              <span className="week-inspector-badge-day">
                {isTodaySelected
                  ? 'Hoy'
                  : formatDate(selectedDateIso, 'UTC', 'es', { weekday: 'long' })}
              </span>
              <span className="week-inspector-date-full">
                {formatDate(selectedDateIso, 'UTC', 'es', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDayKey(null)}
              className="week-inspector-close"
              aria-label="Cerrar detalle"
              title="Volver al resumen"
            >
              <CategoryIcon name="X" size={13} />
            </button>
          </div>

          <div className="week-inspector-body">
            <div className="week-inspector-amount">
              <Money amountMinor={selectedDay.totalExpenseMinor} currency={currency} />
            </div>
            <div className="week-inspector-context">
              {isFutureSelected ? (
                <span className="week-context-pill week-context-pill--neutral">
                  Día por delante
                </span>
              ) : selectedDay.totalExpenseMinor === 0n ? (
                <span className="week-context-pill week-context-pill--zero">
                  Sin gastos registrados ✨
                </span>
              ) : (
                <>
                  <span className="week-context-pill week-context-pill--pct">
                    {pctOfWeek}% de la semana
                  </span>
                  {isPeakDay && (
                    <span className="week-context-pill week-context-pill--peak">
                      Día más alto
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Default Summary Foot */
        <div className="week-card-foot">
          <div className="week-card-stat">
            <span className="fin-stat-label">{t('day_today')}</span>
            <span className="week-card-stat-value">
              <Money amountMinor={week.todayExpenseMinor} currency={currency} />
            </span>
          </div>
          <div className="week-card-stat">
            <span className="fin-stat-label">{t('month_this')}</span>
            <span className="week-card-stat-value">
              <Money amountMinor={monthExpenseMinor} currency={currency} />
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
