import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

import FaqPage, { generateMetadata } from '@/app/faq/page';

describe('FaqPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders localized English FAQ content and metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const element = await FaqPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata).toMatchObject({
      title: 'Frequently asked questions',
      description:
        'Answers to common questions about handmade crochet toys, accessories, home decorations, inquiries, materials, delivery, and care from Happy Colors.',
      alternates: { canonical: '/en/faq' },
    });

    render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'catalog' })) {
      expect(link).toHaveAttribute('href', '/en/products');
    }
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en/contacts');
    expect(screen.getAllByText('Inquiries and availability').length).toBeGreaterThan(0);
    expect(screen.getByText('Can I pay online through the site?')).toBeInTheDocument();
  });
});
