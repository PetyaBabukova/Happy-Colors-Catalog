import { afterEach, describe, expect, it, vi } from 'vitest';

async function importCartoonsFeature({ enabled = false } = {}) {
  vi.resetModules();

  if (enabled) {
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');
  } else {
    vi.unstubAllEnvs();
  }

  return import('../../../src/config/cartoonsFeature.js');
}

describe('cartoonsFeature config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps the cartoons service gate off by default', async () => {
    const feature = await importCartoonsFeature();

    expect(feature.isCartoonsServiceEnabled).toBe(false);
    expect(feature.getReleasedServiceContext('cartoons')).toBe('');
    expect(feature.getReleasedServiceContextFromSearchParams({ service: 'cartoons' })).toBe('');
  });

  it('releases only the exact cartoons service context when enabled', async () => {
    const feature = await importCartoonsFeature({ enabled: true });

    expect(feature.isCartoonsServiceEnabled).toBe(true);
    expect(feature.getReleasedServiceContext('cartoons')).toBe('cartoons');
    expect(feature.getReleasedServiceContext('other')).toBe('');
    expect(feature.getReleasedServiceContext(['cartoons'])).toBe('');
    expect(feature.getReleasedServiceContext(undefined)).toBe('');
    expect(feature.getReleasedServiceContextFromSearchParams({ service: 'cartoons' })).toBe('cartoons');
    expect(feature.getReleasedServiceContextFromSearchParams({ service: 'other' })).toBe('');
    expect(feature.getReleasedServiceContextFromSearchParams(undefined)).toBe('');
  });
});
