import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSteps, formatSince } from './ingest-setup';
import { STEP_ART } from './step-art';
import { STEP_SHOTS } from './step-shots';

/**
 * The "last one arrived X ago" line is the whole point of the confirmed state:
 * it is what tells the user the pipe is alive NOW rather than alive once. A
 * unit that rolls over wrong reports an outage that is not happening.
 */
describe('formatSince', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  const cases: readonly (readonly [string, string])[] = [
    ['2026-09-09T11:59:30.000Z', 'segundo'],
    ['2026-09-09T11:56:00.000Z', 'minuto'],
    ['2026-09-09T09:00:00.000Z', 'hora'],
    // Five, not two: with numeric 'auto' the small counts become words
    // ("ayer", "anteayer"), which is the point of that option.
    ['2026-09-04T12:00:00.000Z', 'día'],
    ['2026-07-09T12:00:00.000Z', 'mes'],
    ['2024-09-09T12:00:00.000Z', 'año'],
  ];

  it.each(cases)('picks the right unit for %s', (iso, unit) => {
    expect(formatSince(iso, now)).toContain(unit);
  });

  it('crosses each boundary instead of sticking to the smaller unit', () => {
    // 90 minutes is an hour and a half: it must not be reported as 90 minutes,
    // and it must not round down to "hace 1 minuto" through integer division.
    expect(formatSince('2026-09-09T10:30:00.000Z', now)).toBe('hace 1 hora');
  });

  it('follows the language the steps are being read in', () => {
    expect(formatSince('2026-09-09T09:00:00.000Z', now, 'en')).toBe('3 hours ago');
  });

  it('returns an empty string for an unparseable instant rather than NaN', () => {
    expect(formatSince('not-a-date', now)).toBe('');
  });
});

/**
 * A step that ships without a picture renders as a wall of text on the screen
 * whose entire purpose is not being a wall of text, and nothing else would
 * catch it: both lookups are by id and a miss is silently undefined.
 */
describe('step pictures', () => {
  it.each(['es', 'en'] as const)('covers every %s step with a capture or a drawing', (locale) => {
    const missing = buildSteps(locale)
      .filter((step) => !STEP_SHOTS[step.id] && !STEP_ART[locale][step.id])
      .map((step) => step.id);

    expect(missing).toEqual([]);
  });

  it('numbers the steps from their position, ending on the final one', () => {
    const steps = buildSteps('es');
    expect(steps[0]?.eyebrow).toBe('Paso 1');
    expect(steps.at(-2)?.eyebrow).toBe(`Paso ${steps.length - 1}`);
    expect(steps.at(-1)?.eyebrow).toBe('Último paso');
  });

  it('has the same steps in both languages', () => {
    expect(buildSteps('en').map((s) => s.id)).toEqual(buildSteps('es').map((s) => s.id));
  });

  /**
   * A screen with nothing lit is a picture of a menu with no answer in it,
   * which is worse than no picture: the reader stops to study it and learns
   * nothing.
   */
  it('lights something to tap on every drawing', () => {
    const blank: string[] = [];

    for (const locale of ['es', 'en'] as const) {
      for (const [id, art] of Object.entries(STEP_ART[locale])) {
        if (!art) continue;
        const lit =
          art.rows.some((row) => row.target) ||
          art.tabs?.some((tab) => tab.startsWith('*')) ||
          art.plus === 'target';
        if (!lit) blank.push(`${locale}/${id}`);
      }
    }

    expect(blank).toEqual([]);
  });
});

/**
 * A capture keyed by a step id that was renamed never renders, and one whose
 * file was not committed renders as a broken image on the step that most
 * needed a picture. Neither shows up anywhere except on someone's phone.
 */
describe('step screenshots', () => {
  it('only exist for real steps, with their file', () => {
    const ids = new Set(buildSteps('es').map((step) => step.id));
    const broken: string[] = [];

    for (const [id, shot] of Object.entries(STEP_SHOTS)) {
      if (!shot) continue;
      if (!ids.has(id)) broken.push(`${id}: no such step`);
      if (!existsSync(join(process.cwd(), 'public', shot.src))) broken.push(`${id}: missing ${shot.src}`);
    }

    expect(broken).toEqual([]);
  });

  it('marks something inside every image', () => {
    const wrong: string[] = [];

    for (const [id, shot] of Object.entries(STEP_SHOTS)) {
      if (!shot) continue;
      if (shot.marks.length === 0) wrong.push(`${id}: nothing marked`);
      for (const [left, top, width, height] of shot.marks) {
        if (left < 0 || top < 0 || left + width > 100 || top + height > 100) {
          wrong.push(`${id}: mark outside the image`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});
