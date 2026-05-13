import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const enforceCoverage = process.env.CI_COVERAGE === 'true';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /(?:src|__tests__)[\\/].*\.[jt]sx?$/,
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    unstubGlobals: true,
    unstubEnvs: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
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
        'src/app/**/{layout,page,not-found,error}.js',
        '**/*.d.ts',
        'next.config.mjs',
      ],
    },
  },
});
