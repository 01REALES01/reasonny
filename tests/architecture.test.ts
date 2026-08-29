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

  it('forbids colour literals in src/components - only CSS variables', () => {
    // A literal here is copyable, and the copy is how one hero gradient
    // becomes a system. Tokens live in app/globals.css.
    const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/;
    const violations: string[] = [];

    for (const file of filesUnder('components')) {
      const content = stripComments(readFileSync(file, 'utf-8'));
      if (colourLiteral.test(content)) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(
      violations,
      `Colour literals found in: ${violations.join(', ')}. Use a CSS variable from globals.css.`,
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
