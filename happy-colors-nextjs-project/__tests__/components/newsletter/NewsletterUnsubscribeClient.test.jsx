import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterUnsubscribeClient from '@/app/newsletter/unsubscribe/NewsletterUnsubscribeClient';
import { unsubscribeFromNewsletter } from '@/managers/newsletterManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/managers/newsletterManager', () => ({
  unsubscribeFromNewsletter: vi.fn(),
}));

describe('NewsletterUnsubscribeClient', () => {
  beforeEach(() => {
    unsubscribeFromNewsletter.mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('shows an invalid-link state when the token is missing', () => {
    render(<NewsletterUnsubscribeClient token="" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(unsubscribeFromNewsletter).not.toHaveBeenCalled();
  });

  it('does not call the backend before explicit confirmation', () => {
    render(<NewsletterUnsubscribeClient token="token-1" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(unsubscribeFromNewsletter).not.toHaveBeenCalled();
  });

  it('unsubscribes only after the confirm button is clicked and redirects to products', async () => {
    const mockRouterReplace = vi.fn();
    vi.useFakeTimers();
    render(<NewsletterUnsubscribeClient token="token-1" />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
      await Promise.resolve();
    });

    expect(unsubscribeFromNewsletter).toHaveBeenCalledWith('token-1');
    expect(screen.getByRole('status')).toHaveTextContent('Успешно се отписахте.');
    expect(mockRouterReplace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/products');
  });

  it('redirects unsubscribed English visitors to the localized products path', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/unsubscribe' });
    const mockRouterReplace = vi.fn();
    vi.useFakeTimers();
    render(<NewsletterUnsubscribeClient token="token-1" />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/en/products');
  });

  it('renders English unsubscribe copy on the English localized route', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/unsubscribe' });

    render(<NewsletterUnsubscribeClient token="token-1" />, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Unsubscribe from news' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsubscribe me' })).toBeInTheDocument();
    expect(screen.queryByText('Отписване от новини')).not.toBeInTheDocument();
  });

  it('renders localized missing-token text', () => {
    render(<NewsletterUnsubscribeClient token="" />);

    expect(screen.getByText('Този линк за отписване е невалиден или непълен.')).toBeInTheDocument();
  });

  it('shows localized unsubscribe errors without redirecting', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/unsubscribe' });
    const mockRouterReplace = vi.fn();
    unsubscribeFromNewsletter.mockRejectedValueOnce(new Error('failed'));
    render(<NewsletterUnsubscribeClient token="token-1" />, {
      locale: 'en',
      routerOverrides: { replace: mockRouterReplace },
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(unsubscribeFromNewsletter).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('We could not unsubscribe you.'));
    expect(screen.getByRole('status')).not.toHaveTextContent('failed');
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
