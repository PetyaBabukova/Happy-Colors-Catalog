import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

import PartnersPage, { generateMetadata } from '@/app/partners/page';

describe('PartnersPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders localized English content and metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const element = await PartnersPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata).toMatchObject({
      title: 'Partners for handmade products and creators',
      description:
        'Happy Colors invites creators and small handmade brands to become partners and present their work in the online catalog.',
      alternates: { canonical: '/en/partners' },
    });

    render(element, { locale: 'en' });

    expect(
      screen.getByRole('heading', { name: 'Would you like us to create together?' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Happy Colors is a place for handmade pieces created with care, warmth, and a personal approach\./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contact me/ })).toHaveAttribute(
      'href',
      '/en/contacts'
    );
  });
});
