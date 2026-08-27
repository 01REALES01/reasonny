import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  toAccountId,
  toAchievementId,
  toApiKeyId,
  toBudgetId,
  toCategoryId,
  toIngestionFailureId,
  toRuleId,
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
    expect(toBudgetId(validUuid)).toBe(validUuid);
    expect(toRuleId(validUuid)).toBe(validUuid);
    expect(toAchievementId(validUuid)).toBe(validUuid);
    expect(toIngestionFailureId(validUuid)).toBe(validUuid);
  });

  it('rejects invalid UUID strings with a descriptive error', () => {
    expect(() => toUserId(invalidUuid)).toThrow(/Invalid UserId/);
    expect(() => toAccountId(invalidUuid)).toThrow(/Invalid AccountId/);
    expect(() => toCategoryId(invalidUuid)).toThrow(/Invalid CategoryId/);
    expect(() => toTransactionId(invalidUuid)).toThrow(/Invalid TransactionId/);
    expect(() => toApiKeyId(invalidUuid)).toThrow(/Invalid ApiKeyId/);
  });
});
