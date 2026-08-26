import { describe, expect, it } from 'vitest';

import { resolveConnectionString } from './env';

const POOLED = 'postgresql://user:pw@ep-cool-name-123456-pooler.us-east-1.aws.neon.tech/realmoney?sslmode=require';
const DIRECT = 'postgresql://user:pw@ep-cool-name-123456.us-east-1.aws.neon.tech/realmoney?sslmode=require';

describe('resolveConnectionString', () => {
  it('gives the app the pooled endpoint', () => {
    expect(resolveConnectionString('runtime', { DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it('gives migrations the direct endpoint', () => {
    expect(resolveConnectionString('migration', { DATABASE_URL_UNPOOLED: DIRECT })).toBe(DIRECT);
  });

  it('names the missing variable instead of failing later at connect time', () => {
    expect(() => resolveConnectionString('runtime', {})).toThrow(/DATABASE_URL is not set/);
    expect(() => resolveConnectionString('migration', {})).toThrow(/DATABASE_URL_UNPOOLED is not set/);
  });

  it('treats whitespace-only values as missing', () => {
    expect(() => resolveConnectionString('runtime', { DATABASE_URL: '   ' })).toThrow(/is not set/);
  });

  // The case this module exists for: migrating through the pooler leaves
  // drizzle-kit's advisory lock guarding nothing, and it fails quietly.
  it('refuses to migrate through the pooler', () => {
    expect(() => resolveConnectionString('migration', { DATABASE_URL_UNPOOLED: POOLED })).toThrow(
      /migrations need the direct one/,
    );
  });

  it('refuses to serve the app from the direct endpoint', () => {
    expect(() => resolveConnectionString('runtime', { DATABASE_URL: DIRECT })).toThrow(
      /runs out under concurrency/,
    );
  });

  it('rejects a value that is not a URL', () => {
    expect(() => resolveConnectionString('runtime', { DATABASE_URL: 'ep-cool-name-pooler.neon.tech' })).toThrow(
      /not a valid connection URL/,
    );
  });
});
