import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterUnsubscribeClient from '@/app/newsletter/unsubscribe/NewsletterUnsubscribeClient';
import { unsubscribeFromNewsletter } from '@/managers/newsletterManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  unsubscribeFromNewsletter: vi.fn(),
}));

describe('NewsletterUnsubscribeClient', () => {
  beforeEach(() => {
    unsubscribeFromNewsletter.mockResolvedValue({ message: 'Успешно се отписахте.' });
  });

  it('shows an invalid-link state when the token is missing', () => {
    render(<NewsletterUnsubscribeClient token="" />);

    expect(screen.getByText(/невалиден/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Отпиши ме/ })).not.toBeInTheDocument();
    expect(unsubscribeFromNewsletter).not.toHaveBeenCalled();
  });

  it('does not call the backend before explicit confirmation', () => {
    render(<NewsletterUnsubscribeClient token="token-1" />);

    expect(screen.getByRole('button', { name: /Отпиши ме/ })).toBeInTheDocument();
    expect(unsubscribeFromNewsletter).not.toHaveBeenCalled();
  });

  it('unsubscribes only after the confirm button is clicked', async () => {
    render(<NewsletterUnsubscribeClient token="token-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Отпиши ме/ }));

    await waitFor(() => expect(unsubscribeFromNewsletter).toHaveBeenCalledWith('token-1'));
    expect(screen.getByRole('status')).toHaveTextContent('Успешно');
  });

  it('shows unsubscribe errors', async () => {
    unsubscribeFromNewsletter.mockRejectedValueOnce(new Error('Не успяхме да ви отпишем.'));
    render(<NewsletterUnsubscribeClient token="token-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Отпиши ме/ }));

    await waitFor(() => expect(unsubscribeFromNewsletter).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Не успяхме');
  });
});
