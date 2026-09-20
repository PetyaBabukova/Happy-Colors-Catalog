import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

vi.hoisted(() => {
  vi.stubEnv('RENDER_GIT_BRANCH', 'main');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
});

import FaqPage, { generateMetadata } from '@/app/faq/page';

describe('FaqPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates Bulgarian FAQ metadata for the default route', async () => {
    const metadata = await generateMetadata();

    expect(metadata).toMatchObject({
      title: 'Често задавани въпроси',
      description:
        'Отговори за плетени играчки по поръчка, грижа, пране, материали и поддръжка на ръчно изработени изделия от Happy Colors.',
      alternates: { canonical: '/faq' },
    });
  });

  it('renders localized English FAQ content and metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const element = await FaqPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata).toMatchObject({
      title: 'Frequently asked questions',
      description:
        'Answers about crochet toy care, cleaning and washing, custom crochet toys, materials, delivery and handmade toys for children.',
      alternates: { canonical: '/en/faq' },
    });

    const { container } = render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'catalog' })) {
      expect(link).toHaveAttribute('href', '/en/products');
    }
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en/contacts');
    expect(screen.getAllByText('Inquiries and availability').length).toBeGreaterThan(0);
    expect(screen.getByText('Can I pay online through the site?')).toBeInTheDocument();

    const [faqJsonLd] = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent));

    expect(faqJsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
    });
    expect(faqJsonLd.mainEntity.length).toBeGreaterThan(10);
    expect(faqJsonLd.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      acceptedAnswer: {
        '@type': 'Answer',
      },
    });
    expect(JSON.stringify(faqJsonLd)).not.toMatch(/localhost|preview|onrender|vercel|netlify/i);
  });
});
