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
      name: 'unit-jsdom',
      environment: 'jsdom',
      include: ['__tests__/unit-jsdom/**/*.test.{js,jsx}'],
    },
  },
  {
    extends: './vitest.config.js',
    test: {
      name: 'components',
      environment: 'jsdom',
      include: ['__tests__/components/**/*.test.jsx'],
      setupFiles: ['__tests__/components/setup.js'],
    },
  },
  {
    extends: './vitest.config.js',
    test: {
      name: 'api',
      environment: 'node',
      include: ['__tests__/api/**/*.test.js'],
      setupFiles: ['__tests__/api/setup.js'],
    },
  },
]);
