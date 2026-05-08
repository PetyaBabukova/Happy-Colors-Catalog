import { defineConfig } from 'vitest/config';

const enforceCoverage = process.env.CI_COVERAGE === 'true';

export default defineConfig({
  test: {
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['**/*.js'],
      thresholds: enforceCoverage
        ? {
            lines: 80,
            branches: 75,
            functions: 80,
            statements: 80,
          }
        : undefined,
      exclude: [
        '__tests__/**',
        '**/*.config.{js,mjs}',
        'dev-server.js',
        'vitest.workspace.js',
        'server.js',
        'routes.js',
        'mongoose.js',
        'node_modules/**',
      ],
    },
  },
});
