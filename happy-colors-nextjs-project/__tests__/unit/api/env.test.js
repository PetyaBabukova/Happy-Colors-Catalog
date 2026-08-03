import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('server env loading', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not read fallback env files after the shared test env loader ran', async () => {
    const existsSync = vi.fn();
    const config = vi.fn();

    vi.doMock('fs', () => ({
      default: { existsSync },
    }));
    vi.doMock('dotenv', () => ({
      default: { config },
    }));
    vi.stubEnv('HAPPY_COLORS_TEST_ENV_LOADED', 'true');

    const { ensureServerEnvLoaded } = await import('../../../src/app/api/_lib/env.js');
    ensureServerEnvLoaded();

    expect(existsSync).not.toHaveBeenCalled();
    expect(config).not.toHaveBeenCalled();
  });
});
