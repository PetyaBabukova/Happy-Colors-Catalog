import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm';
import { subscribeToNewsletter } from '@/managers/newsletterManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  subscribeToNewsletter: vi.fn(),
}));

describe('NewsletterSubscribeForm', () => {
  beforeEach(() => {
    subscribeToNewsletter.mockResolvedValue({ message: 'Успешно се абонирахте.' });
  });

  it('requires email and consent before submitting', () => {
    const { container } = render(<NewsletterSubscribeForm />);

    fireEvent.submit(container.querySelector('form'));

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Моля, въведете email адрес.');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'petya@example.com' },
    });
    fireEvent.submit(container.querySelector('form'));

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Моля, потвърдете');
  });

  it('submits the email, consent, and honeypot payload then clears the form', async () => {
    const { container } = render(<NewsletterSubscribeForm />);
    const emailInput = screen.getByLabelText('Email');
    const consentInput = screen.getByLabelText(/Съгласен съм/);
    const honeypot = container.querySelector('input[name="website"]');

    fireEvent.change(emailInput, { target: { value: 'petya@example.com' } });
    fireEvent.change(honeypot, { target: { value: '' } });
    fireEvent.click(consentInput);
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(subscribeToNewsletter).toHaveBeenCalledWith({
        email: 'petya@example.com',
        consent: true,
        website: '',
      })
    );

    expect(screen.getByRole('status')).toHaveTextContent('Успешно');
    expect(emailInput).toHaveValue('');
    expect(consentInput).not.toBeChecked();
  });

  it('keeps the form values and shows backend errors when submit fails', async () => {
    subscribeToNewsletter.mockRejectedValueOnce(new Error('Твърде много опити'));
    const { container } = render(<NewsletterSubscribeForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'petya@example.com' },
    });
    fireEvent.click(screen.getByLabelText(/Съгласен съм/));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(subscribeToNewsletter).toHaveBeenCalled());

    expect(screen.getByRole('status')).toHaveTextContent(
      'Не успяхте да се абонирате. Моля опитайте по-късно.'
    );
    expect(screen.getByLabelText('Email')).toHaveValue('petya@example.com');
    expect(screen.getByLabelText(/Съгласен съм/)).toBeChecked();
  });

  it('shows duplicate subscription messages with error styling', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({
      message: 'Вече имате абонамент за тази страница.',
      status: 'already_subscribed',
    });
    const { container } = render(<NewsletterSubscribeForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'petya@example.com' },
    });
    fireEvent.click(screen.getByLabelText(/Съгласен съм/));
    fireEvent.submit(container.querySelector('form'));

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent('Вече имате абонамент за тази страница.');
    expect(status.className).toContain('errorMessage');
  });

  it('includes a hidden honeypot field', () => {
    const { container } = render(<NewsletterSubscribeForm />);
    const honeypot = container.querySelector('input[name="website"]');

    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
  });
});
