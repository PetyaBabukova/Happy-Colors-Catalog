import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.js',
    test: {
      name: 'unit',
      environment: 'node',
      include: ['__tests__/unit/**/*.test.js'],
    },
  },
  {
    extends: './vitest.config.js',
    test: {
      name: 'integration',
      environment: 'node',
      include: ['__tests__/integration/**/*.test.js'],
      setupFiles: ['__tests__/integration/setup.js'],
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  },
]);
