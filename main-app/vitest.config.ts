import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'app/api/**/*.ts',
        'lib/actions/**/*.ts',
        'lib/agents/**/*.ts',
        'lib/controllers/**/*.ts',
        'lib/repositories/**/*.ts',
        'lib/services/**/*.ts',
        'lib/strategies/**/*.ts',
      ],
      exclude: ['**/*.d.ts', '**/*.types.ts', 'lib/types/**', 'lib/supabase/db/**', 'tests/**'],
    },
  },
});
