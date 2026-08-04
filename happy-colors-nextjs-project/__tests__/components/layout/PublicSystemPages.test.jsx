import { afterEach, describe, expect, it, vi } from 'vitest';
import AppError from '@/app/error';
import { resolveGlobalErrorLocale } from '@/app/global-error';
import NotFound from '@/app/not-found';
import { PublicStatusPageView } from '@/components/ui/PublicStatusPage';
import { fireEvent, render, screen } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

describe('public system pages', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a Bulgarian not-found page on the default locale', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: 'Страницата не е намерена' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Начало' })).toHaveAttribute('href', '/');
  });

  it('renders an English not-found page and preserves the locale in its home link', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/products/missing' });

    render(<NotFound />, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
  });

  it('renders a localized retry action and invokes the error boundary reset', () => {
    const reset = vi.fn();

    render(<AppError reset={reset} />, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('resolves and renders the root error content without an i18n provider', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const reset = vi.fn();

    expect(resolveGlobalErrorLocale('/en/products/product-1')).toBe('en');

    render(
      <PublicStatusPageView
        title="Something went wrong"
        description="Please try again in a moment."
        homeHref="/en"
        homeLabel="Home"
        retryLabel="Try again"
        onRetry={reset}
      />,
      {
      wrapper: ({ children }) => children,
      }
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
