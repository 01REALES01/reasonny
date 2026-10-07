'use client';

import React, { useMemo, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { buildMonthGrid, topCategories } from '@/core/calendar';
import type { DayGroup } from '@/core/services/analytics.service';
import { formatDate, t } from '@/lib/i18n';

import { PhoneLedger } from './phone-ledger';

interface MonthCalendarProps {
  readonly days: readonly DayGroup[];
  /** 'YYYY-MM' of the month shown. */
  readonly monthKey: string;
  /** 'YYYY-MM-DD' of today, in the profile's zone. */
  readonly todayKey: string;
  readonly currency: string;
  readonly timeZone: string;
  /** Opened from the week card (/mes?dia=...): that day starts selected. */
  readonly initialDay?: string | null | undefined;
}

// A known Monday, so the weekday initials come from Intl in the active locale
// instead of a hand-written "L M M J V S D" that would be wrong in English.
const A_MONDAY = Date.UTC(2026, 9, 5, 12);
const WEEKDAY_INITIALS = Array.from({ length: 7 }, (_, i) =>
  formatDate(A_MONDAY + i * 86_400_000, 'UTC', undefined, { weekday: 'narrow' }),
);

/** Noon UTC on that calendar date: formats as that date in any zone we label with 'UTC'. */
const noonOf = (dayKey: string): string => `${dayKey}T12:00:00Z`;

/**
 * The month as a calendar: each day shows where most of its money went (up to
 * two category icons) and how much, and tapping it narrows the list below to
 * that day.
 *
 * Built from the same day groups the list already uses - the per-day totals
 * come from SQL in the user's zone (rule 4) - so the calendar adds no query.
 * Selection is local state on one component: a tap re-renders 42 small cells
 * and the list, nothing else, which keeps INP inside budget.
 */
export function MonthCalendar({
  days,
  monthKey,
  todayKey,
  currency,
  timeZone,
  initialDay,
}: MonthCalendarProps): React.ReactElement {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const weeks = useMemo(() => buildMonthGrid(monthKey), [monthKey]);
  const [selected, setSelected] = useState<string | null>(
    initialDay && initialDay.startsWith(monthKey) ? initialDay : null,
  );

  const selectedGroup = selected ? byDay.get(selected) : undefined;

  return (
    <>
      <section className="month-calendar" aria-label={t('calendar_title')}>
        <div className="month-calendar-weekdays" aria-hidden="true">
          {WEEKDAY_INITIALS.map((initial, i) => (
            <span key={i}>{initial}</span>
          ))}
        </div>

        <div className="month-calendar-grid">
          {weeks.map((week, w) => (
            <div key={w} className="month-calendar-week">
              {week.map((dayKey, i) => {
                if (!dayKey) {
                  return <span key={`blank-${w}-${i}`} className="month-calendar-cell--blank" />;
                }
                const group = byDay.get(dayKey);
                const isFuture = dayKey > todayKey;
                const isToday = dayKey === todayKey;
                const isSelected = dayKey === selected;
                const icons = group ? topCategories(group.transactions, currency, 2) : [];
                const spent = group && group.totalExpenseMinor > 0n ? group.totalExpenseMinor : null;
                const count = group?.transactions.filter((tx) => tx.type === 'expense').length ?? 0;

                return (
                  <button
                    key={dayKey}
                    type="button"
                    disabled={isFuture}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${formatDate(noonOf(dayKey), 'UTC', undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}${count ? `, ${count} ${t('calendar_spends')}` : ''}`}
                    onClick={() => setSelected(isSelected ? null : dayKey)}
                    className={[
                      'month-calendar-cell',
                      isToday ? 'month-calendar-cell--today' : '',
                      isSelected ? 'month-calendar-cell--selected' : '',
                      spent ? 'month-calendar-cell--spent' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="month-calendar-number">{Number(dayKey.slice(8))}</span>
                    <span className="month-calendar-icons" aria-hidden="true">
                      {icons.map((c) => (
                        <span
                          key={c.icon}
                          className="month-calendar-icon"
                          style={{ '--tx-icon-ink': c.color } as React.CSSProperties}
                        >
                          <CategoryIcon name={c.icon} size={12} />
                        </span>
                      ))}
                    </span>
                    {spent !== null && (
                      <span className="month-calendar-amount">
                        <Money amountMinor={spent} currency={currency} compact />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {selected && (
        <div className="month-calendar-selection" role="status" aria-live="polite">
          <span className="month-calendar-selection-date">
            {formatDate(noonOf(selected), 'UTC', undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="phone-ledger-clear-btn"
          >
            {t('calendar_show_month')}
          </button>
        </div>
      )}

      {selected && !selectedGroup ? (
        <p className="month-calendar-empty">{t('calendar_day_empty')}</p>
      ) : (
        <PhoneLedger
          days={selectedGroup ? [selectedGroup] : [...days]}
          currency={currency}
          timeZone={timeZone}
        />
      )}
    </>
  );
}
