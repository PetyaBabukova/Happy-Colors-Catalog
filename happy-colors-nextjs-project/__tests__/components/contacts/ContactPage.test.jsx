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

  it('generates indexable Bulgarian contact metadata on the production site', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');

    const { generateMetadata } = await import('@/app/contacts/page');

    await expect(generateMetadata()).resolves.toMatchObject({
      description:
        'Свържете се с Happy Colors за въпроси, наличност на изделия, индивидуални поръчки и шаржове по снимка. Изпратете запитване чрез контактната форма.',
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: '/contacts',
      },
    });
  });

  it('generates localized English contact metadata on the production site', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const { generateMetadata } = await import('@/app/contacts/page');

    await expect(generateMetadata({ params: Promise.resolve({ locale: 'en' }) })).resolves.toMatchObject({
      description:
        'Contact Happy Colors about product availability, custom orders, handmade crochet items and custom caricatures from photos. Send your enquiry through the contact form.',
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: '/en/contacts',
      },
    });
  });

  it('keeps contact metadata noindex outside the production site', async () => {
    const { generateMetadata } = await import('@/app/contacts/page');

    await expect(generateMetadata()).resolves.toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });
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
