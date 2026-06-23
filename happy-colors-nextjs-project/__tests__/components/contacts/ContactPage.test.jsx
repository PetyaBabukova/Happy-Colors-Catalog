import { afterEach, describe, expect, it, vi } from 'vitest';

function setupContactPage({ enabled = false, product = null } = {}) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', enabled ? 'true' : 'false');

  const getProduct = vi.fn().mockResolvedValue(product);

  vi.doMock('@/lib/getProduct', () => ({
    getProduct,
  }));

  return {
    getProduct,
    importPageData: () => import('@/app/contacts/contactPageData.js'),
  };
}

describe('ContactPage', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/getProduct');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('forwards cartoon service context when the release gate is enabled', async () => {
    const product = { _id: 'product-1', title: 'Cartoon Product' };
    const { getProduct, importPageData } = setupContactPage({
      enabled: true,
      product,
    });
    const { resolveContactPageData } = await importPageData();
    const data = await resolveContactPageData({ productId: 'product-1', service: 'cartoons' });

    expect(getProduct).toHaveBeenCalledWith('product-1');
    expect(data).toEqual({
      product,
      productId: 'product-1',
      serviceContext: 'cartoons',
    });
  });

  it('strips cartoon service context when the release gate is disabled', async () => {
    const product = { _id: 'product-1', title: 'Cartoon Product' };
    const { importPageData } = setupContactPage({
      enabled: false,
      product,
    });
    const { resolveContactPageData } = await importPageData();
    const data = await resolveContactPageData({ productId: 'product-1', service: 'cartoons' });

    expect(data).toEqual({
      product,
      productId: 'product-1',
      serviceContext: '',
    });
  });
});
