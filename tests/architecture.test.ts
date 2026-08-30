import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  toAccountId,
  toApiKeyId,
  toCategoryId,
  toTransactionId,
  toUserId,
} from '@/core/types';

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Architecture Rules & Tenant Isolation', () => {
  const srcRoot = join(process.cwd(), 'src');
  const allSrcFiles = getAllSourceFiles(srcRoot);

  it('forbids database access (getDb or Drizzle schema queries) outside src/core/repositories and src/infrastructure/db', () => {
    const forbiddenPattern = /(from ['"]@\/infrastructure\/db\/client['"]|getDb\(\))/;
    const allowedPrefixes = [
      'core/repositories',
      'infrastructure/db',
    ];

    const violations: string[] = [];

    for (const file of allSrcFiles) {
      const rel = relative(srcRoot, file);
      const isAllowed = allowedPrefixes.some((prefix) => rel.startsWith(prefix));

      if (!isAllowed) {
        const content = readFileSync(file, 'utf-8');
        if (forbiddenPattern.test(content)) {
          violations.push(rel);
        }
      }
    }

    expect(
      violations,
      `Found direct database access outside repository layer in: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  it('forbids direct schema imports outside core and infrastructure layers', () => {
    const schemaImportPattern = /from ['"]@\/infrastructure\/db\/schema['"]/;
    const allowedPrefixes = [
      'core/repositories',
      'infrastructure/db',
    ];

    const violations: string[] = [];

    for (const file of allSrcFiles) {
      const rel = relative(srcRoot, file);
      const isAllowed = allowedPrefixes.some((prefix) => rel.startsWith(prefix));

      if (!isAllowed) {
        const content = readFileSync(file, 'utf-8');
        if (schemaImportPattern.test(content)) {
          violations.push(rel);
        }
      }
    }

    expect(
      violations,
      `Found direct schema imports in UI/Client layer: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});

describe('Branded Types Validation', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const invalidUuid = 'not-a-valid-uuid';

  it('accepts valid UUIDs for all branded types', () => {
    expect(toUserId(validUuid)).toBe(validUuid);
    expect(toAccountId(validUuid)).toBe(validUuid);
    expect(toCategoryId(validUuid)).toBe(validUuid);
    expect(toTransactionId(validUuid)).toBe(validUuid);
    expect(toApiKeyId(validUuid)).toBe(validUuid);
  });

  it('rejects invalid UUID strings with a descriptive error', () => {
    expect(() => toUserId(invalidUuid)).toThrow(/Invalid UserId/);
    expect(() => toAccountId(invalidUuid)).toThrow(/Invalid AccountId/);
    expect(() => toCategoryId(invalidUuid)).toThrow(/Invalid CategoryId/);
    expect(() => toTransactionId(invalidUuid)).toThrow(/Invalid TransactionId/);
    expect(() => toApiKeyId(invalidUuid)).toThrow(/Invalid ApiKeyId/);
  });
});

/**
 * The design-system rules CLAUDE.md calls merge-blocking.
 *
 * They were merge-blocking in prose only. Unlike the repository boundary above,
 * nothing checked them - and both were already being violated when this was
 * written: an orange gradient hardcoded in hero-card.tsx, and an amount
 * rendered with toLocaleString in the entry form. A rule with no test is a
 * preference.
 */
describe('Design System Rules (DESIGN_SYSTEM.md)', () => {
  const srcRoot = join(process.cwd(), 'src');

  /**
   * Strips comments before matching. Without this the tests fail on their own
   * explanations: the entry form carries a comment saying why it does NOT use
   * toLocaleString, and that sentence contains the word.
   */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  function filesUnder(dir: string): string[] {
    return getAllSourceFiles(join(srcRoot, dir));
  }

  /**
   * app/ as well as components/, and that is the whole point of this change.
   *
   * The rule was only ever checked under components/, so every violation had
   * accumulated on the other side of the line: 46 hardcoded colours across the
   * sign-in form, the dashboard and the entry form, on a suite that was green.
   * layout.tsx and manifest.ts are exempt because their colours are read by
   * the browser chrome and the OS installer, before and outside any
   * stylesheet - a var() there resolves to nothing. The test below pins them
   * to the token instead.
   */
  it('forbids colour literals in src/components and src/app - only CSS variables', () => {
    // A literal here is copyable, and the copy is how one hero gradient
    // becomes a system. Tokens live in app/globals.css.
    const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/;
    const exempt = ['app/layout.tsx', 'app/manifest.ts'];
    const violations: string[] = [];

    for (const file of [...filesUnder('components'), ...filesUnder('app')]) {
      const rel = relative(srcRoot, file);
      if (exempt.includes(rel)) continue;

      const content = stripComments(readFileSync(file, 'utf-8'));
      if (colourLiteral.test(content)) {
        violations.push(rel);
      }
    }

    expect(
      violations,
      `Colour literals found in: ${violations.join(', ')}. Use a CSS variable from globals.css.`,
    ).toEqual([]);
  });

  /**
   * The two files exempted above still have to agree with the palette.
   *
   * They are the first colour the user sees: theme_color paints the iOS status
   * bar and background_color paints the PWA splash screen, both before the app
   * renders a pixel. A drift from --surface-base is a visible flash of the
   * wrong background on every cold launch, and nothing else in the suite would
   * notice.
   */
  it('pins the manifest and viewport colours to the --surface-base token', () => {
    const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf-8');
    const surfaceBase = css.match(/--surface-base:\s*(#[0-9a-fA-F]{3,8})/)?.[1];
    expect(surfaceBase, '--surface-base is not declared in globals.css').toBeDefined();

    for (const file of ['app/layout.tsx', 'app/manifest.ts']) {
      const source = stripComments(readFileSync(join(srcRoot, file), 'utf-8'));
      for (const literal of source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
        expect(
          literal.toLowerCase(),
          `${file} uses ${literal}, which is not --surface-base (${surfaceBase}).`,
        ).toBe(surfaceBase!.toLowerCase());
      }
    }
  });

  /**
   * "Solo se animan transform y opacity" is on CLAUDE.md's merge-blocking list,
   * and until now nothing checked it - the other rules here read .ts and .tsx,
   * and every animation in this project lives in a stylesheet.
   *
   * The gap was not theoretical. Converting the sign-in form's inline styles
   * turned a `transition: all` into an explicit background-color/border-color
   * transition, with a comment arguing why that was acceptable. It was not, and
   * a rule whose only enforcement is the reviewer's memory is a preference.
   *
   * transform and opacity are composited off the main thread; width, height,
   * top, margin and background-color force layout or paint on it, which is the
   * INP budget (P7) spent on decoration.
   */
  it('forbids animating anything but transform and opacity in the stylesheet', () => {
    const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    const allowed = new Set(['transform', 'opacity', 'none', 'inherit', 'initial', 'unset']);
    const violations: string[] = [];

    /**
     * Splits a transition value on its TOP-LEVEL commas only.
     *
     * A plain split(',') tears `cubic-bezier(0.23, 1, 0.32, 1)` into four
     * pieces and then reads "1" and "0.32" as animated property names. The
     * first version of this test did exactly that and reported them as
     * violations, which is the kind of false positive that gets a gate
     * disabled rather than obeyed.
     */
    function topLevelParts(value: string): string[] {
      const parts: string[] = [];
      let depth = 0;
      let current = '';
      for (const char of value) {
        if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        if (char === ',' && depth === 0) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      return parts;
    }

    // `transition:` and `transition-property:` declarations. `animation:`
    // shorthand names a @keyframes block instead of properties, and the
    // keyframes below are checked separately.
    for (const [, value] of css.matchAll(/\btransition(?:-property)?\s*:\s*([^;}]+)/g)) {
      for (const part of topLevelParts(value!)) {
        const property = part.trim().split(/\s+/)[0];
        if (property && !allowed.has(property)) {
          violations.push(`transition: ${property}`);
        }
      }
    }

    // Inside @keyframes, every declared property is animated by definition.
    //
    // The block is found by counting braces rather than by a lazy regex ending
    // at "\n}": that version only matched keyframes formatted across multiple
    // lines, so a single-line @keyframes slipped through the gate entirely.
    for (const match of css.matchAll(/@keyframes\s+[\w-]+\s*\{/g)) {
      let depth = 1;
      let index = match.index + match[0].length;
      const start = index;
      while (index < css.length && depth > 0) {
        if (css[index] === '{') depth += 1;
        else if (css[index] === '}') depth -= 1;
        index += 1;
      }
      const body = css.slice(start, index - 1);

      for (const [, property] of body.matchAll(/([a-z-]+)\s*:/g)) {
        if (!allowed.has(property!)) {
          violations.push(`@keyframes: ${property}`);
        }
      }
    }

    expect(
      [...new Set(violations)],
      'Only transform and opacity may be animated (CLAUDE.md, Diseño). ' +
        'Everything else forces layout or paint on the main thread.',
    ).toEqual([]);
  });

  it('forbids rendering money outside the <Money> component', () => {
    // The decimal de-emphasis rule and tabular figures live in <Money>. An
    // amount formatted anywhere else silently opts out of both, and two
    // numbers on the same screen stop lining up.
    const manualFormatting = /toLocaleString|Intl\.NumberFormat/;
    const allowed = ['components/ui/money.tsx', 'lib/i18n.ts', 'core/money.ts'];
    const violations: string[] = [];

    for (const file of [...filesUnder('components'), ...filesUnder('app')]) {
      const rel = relative(srcRoot, file);
      if (allowed.includes(rel)) continue;

      const content = stripComments(readFileSync(file, 'utf-8'));
      if (manualFormatting.test(content)) {
        violations.push(rel);
      }
    }

    expect(
      violations,
      `Money formatted outside <Money> in: ${violations.join(', ')}.`,
    ).toEqual([]);
  });
});
