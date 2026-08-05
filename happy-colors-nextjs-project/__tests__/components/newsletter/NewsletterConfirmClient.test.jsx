import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterConfirmClient from '@/app/newsletter/confirm/NewsletterConfirmClient';
import { confirmNewsletterSubscription } from '@/managers/newsletterManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/managers/newsletterManager', () => ({
  confirmNewsletterSubscription: vi.fn(),
}));

function setConfirmUrl(hash = '') {
  window.history.pushState(null, '', `/newsletter/confirm${hash}`);
}

describe('NewsletterConfirmClient', () => {
  beforeEach(() => {
    vi.useRealTimers();
    confirmNewsletterSubscription.mockResolvedValue({ message: 'confirmed' });
    setConfirmUrl('');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('shows an invalid-link state when the token is missing', async () => {
    render(<NewsletterConfirmClient />);

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    expect(confirmNewsletterSubscription).not.toHaveBeenCalled();
  });

  it('does not confirm on mount and strips the hash after reading the token', async () => {
    setConfirmUrl('#token=token-1');

    render(<NewsletterConfirmClient />);

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    expect(confirmNewsletterSubscription).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('posts the token after click and redirects to products after the success delay', async () => {
    setConfirmUrl('#token=token-1');
    const mockRouterReplace = vi.fn();

    render(<NewsletterConfirmClient />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(confirmNewsletterSubscription).toHaveBeenCalledWith('token-1');
    expect(screen.getByRole('status')).toHaveTextContent('Абонаментът ви е потвърден успешно.');
    expect(mockRouterReplace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/products');
  });

  it('redirects confirmed English subscribers to the localized products path', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/confirm' });
    setConfirmUrl('#token=token-1');
    const mockRouterReplace = vi.fn();

    render(<NewsletterConfirmClient />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/en/products');
    expect(confirmNewsletterSubscription).toHaveBeenCalledWith('token-1');
  });

  it('renders English confirmation copy on the English localized route', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/confirm' });
    setConfirmUrl('#token=token-1');

    render(<NewsletterConfirmClient />, { locale: 'en' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm subscription' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Confirm subscription' })).toBeInTheDocument();
    expect(screen.queryByText('Потвърждение на абонамент')).not.toBeInTheDocument();
  });

  it('renders localized missing-token text', async () => {
    render(<NewsletterConfirmClient />);

    await waitFor(() => {
      expect(screen.getByText('Този линк за потвърждение е невалиден или непълен.')).toBeInTheDocument();
    });
  });

  it('shows the localized error copy for invalid or expired tokens', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/newsletter/confirm' });
    setConfirmUrl('#token=expired-token');
    confirmNewsletterSubscription.mockRejectedValueOnce(new Error('backend-only-error'));

    render(<NewsletterConfirmClient />, { locale: 'en' });

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(confirmNewsletterSubscription).toHaveBeenCalledWith('expired-token'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'This confirmation link is invalid or expired. Please submit the subscription form again.'
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('backend-only-error');
  });
});
