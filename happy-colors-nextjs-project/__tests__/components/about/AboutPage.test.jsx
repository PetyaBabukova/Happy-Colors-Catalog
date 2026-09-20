import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

vi.hoisted(() => {
  vi.stubEnv('RENDER_GIT_BRANCH', 'main');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
});

import AboutPage, { generateMetadata } from '@/app/aboutus/page';

describe('AboutPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates Bulgarian metadata for the default about route', async () => {
    const metadata = await generateMetadata();

    expect(metadata).toMatchObject({
      title: {
        absolute: 'За Happy Colors | Хепи Колорс | Плетени играчки и декорация за дома',
      },
      description:
        'Научете повече за Happy Colors (Хепи Колорс) и ръчно изработените плетени играчки, handmade изделия, аксесоари и декорация за дома.',
      alternates: { canonical: '/aboutus' },
    });
  });

  it('renders localized English content and metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const element = await AboutPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata).toMatchObject({
      title: {
        absolute: 'About Happy Colors | Crochet Toys and Handmade Decor',
      },
      description:
        'Learn about Happy Colors and its handmade crochet toys, handmade gifts, crochet accessories, bags, and home decor made with care.',
      alternates: { canonical: '/en/aboutus' },
    });

    render(element, { locale: 'en' });

    expect(
      screen.getByRole('heading', {
        name: 'Happy Colors - a world of handmade crochet toys, accessories, and decorations',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByAltText('Crocheted lion, small backpack, and colorful yarn from Happy Colors')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'catalog' })).toHaveAttribute('href', '/en/products');
    expect(screen.getByRole('link', { name: /Happy Colors gallery/ })).toHaveAttribute(
      'href',
      '/en/products'
    );
  });
});
