import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterUnsubscribeClient from '@/app/newsletter/unsubscribe/NewsletterUnsubscribeClient';
import { unsubscribeFromNewsletter } from '@/managers/newsletterManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  unsubscribeFromNewsletter: vi.fn(),
}));

describe('NewsletterUnsubscribeClient', () => {
  beforeEach(() => {
    unsubscribeFromNewsletter.mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(screen.getByRole('status')).toHaveTextContent('ok');
    expect(mockRouterReplace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/products');
  });

  it('shows unsubscribe errors without redirecting', async () => {
    const mockRouterReplace = vi.fn();
    unsubscribeFromNewsletter.mockRejectedValueOnce(new Error('failed'));
    render(<NewsletterUnsubscribeClient token="token-1" />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(unsubscribeFromNewsletter).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('failed');
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
