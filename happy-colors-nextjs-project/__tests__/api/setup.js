import { afterEach, vi } from 'vitest';

afterEach(() => {
  // The API route tests use vi.doMock() plus dynamic imports, so each test
  // needs a fresh module graph. Mock/global/env cleanup lives in vitest.config.js.
  vi.resetModules();
});
