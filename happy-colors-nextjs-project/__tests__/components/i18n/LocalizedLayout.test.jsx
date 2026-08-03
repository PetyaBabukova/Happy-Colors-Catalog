import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocalizedLayout, { generateMetadata } from '@/app/(localized)/[locale]/layout';

describe('LocalizedLayout', () => {
  it('404s localized routes while locale routing is disabled', async () => {
    await expect(
      LocalizedLayout({
        children: <div>Localized content</div>,
        params: Promise.resolve({ locale: 'bg' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders enabled Bulgarian localized routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const element = await LocalizedLayout({
      children: <div>Localized content</div>,
      params: Promise.resolve({ locale: 'bg' }),
    });

    render(element);

    expect(screen.getByText('Localized content')).toBeInTheDocument();
  });

  it('404s English localized routes while English is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    await expect(
      LocalizedLayout({
        children: <div>English content</div>,
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders English localized routes when both gates are enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const element = await LocalizedLayout({
      children: <div>English content</div>,
      params: Promise.resolve({ locale: 'en' }),
    });

    render(element);

    expect(screen.getByText('English content')).toBeInTheDocument();
  });

  it('provides English default metadata and a language-neutral title suffix', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(metadata.title).toEqual({
      default: 'Handmade Crochet Toys, Accessories, And Home Decor | Happy Colors',
      template: '%s | Happy Colors',
    });
    expect(metadata.description).not.toMatch(/[А-Яа-я]/);
  });

  it('keeps the Bulgarian title suffix for Bulgarian localized routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'bg' }),
    });

    expect(metadata.title.template).toBe('%s | Happy Colors | Хепи Колорс');
  });

  it('404s unsupported locale segments', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    await expect(
      LocalizedLayout({
        children: <div>Unsupported content</div>,
        params: Promise.resolve({ locale: 'fr' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
