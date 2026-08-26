import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Everything under test here is server-side arithmetic and data access.
    // A DOM environment would only add startup cost.
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/infrastructure/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/infrastructure/db/schema.ts'],
      reporter: ['text-summary', 'text'],
      // money.ts is the only module with a hard 100% gate, and it blocks the
      // merge. Not perfectionism: every uncovered branch here is a rounding
      // path nobody has ever executed, in the module that decides how much
      // money the user has.
      thresholds: {
        '**/src/core/money.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
