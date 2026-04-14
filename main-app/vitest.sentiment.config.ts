import path from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    pool: 'threads',
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'tests/unit/agents/sentiment-agent.test.ts',
      'tests/unit/services/feedback-analysis.service.test.ts',
      'tests/integration/api/feedback-analyze-sentiment.route.test.ts',
      'tests/unit/controllers/feedback.controller.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage/sentiment',
      include: [
        'app/api/feedback/[id]/analyze-sentiment/route.ts',
        'lib/agents/sentiment/sentiment-agent.ts',
        'lib/services/feedback-analysis.service.ts',
      ],
      exclude: ['**/*.d.ts', '**/*.types.ts', 'lib/types/**', 'tests/**'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
