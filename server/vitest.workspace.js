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
]);
