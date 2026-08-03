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

  it('renders localized English content and metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const element = await AboutPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata).toMatchObject({
      title: {
        absolute: 'About Happy Colors | Handmade Crochet Toys And Home Decor',
      },
      description:
        'Learn more about Happy Colors and the handmade crochet toys, accessories, and home decorations created with care and attention to detail.',
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
