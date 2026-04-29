import { afterEach, describe, expect, it, vi } from 'vitest';

async function importCatalogMode(value) {
  vi.resetModules();

  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_CATALOG_MODE;
  } else {
    process.env.NEXT_PUBLIC_CATALOG_MODE = value;
  }

  return import('../../../src/utils/catalogMode.js');
}

describe('catalogMode', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CATALOG_MODE;
    vi.resetModules();
  });

  it('is enabled only when NEXT_PUBLIC_CATALOG_MODE is true', async () => {
    await expect(importCatalogMode('true')).resolves.toMatchObject({ isCatalogMode: true });
    await expect(importCatalogMode('false')).resolves.toMatchObject({ isCatalogMode: false });
    await expect(importCatalogMode(undefined)).resolves.toMatchObject({ isCatalogMode: false });
  });
});
