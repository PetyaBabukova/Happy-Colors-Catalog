import { describe, expect, it, vi } from 'vitest';
import Footer from '@/components/layout/Footer';
import { render, screen } from '../test-utils.jsx';

vi.mock('@/components/newsletter/NewsletterSubscribeForm', () => ({
  default: () => <form aria-label="newsletter form" />,
}));

vi.mock('@/components/privacy/CookieFooterLink', () => ({
  default: () => <button type="button">Cookie settings</button>,
}));

describe('Footer', () => {
  it('preserves footer content and renders the newsletter form', () => {
    render(<Footer />);

    expect(screen.getByText(/Happy Colors/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'newsletter form' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /webcreativeteam\.com/ })).toHaveAttribute(
      'href',
      'https://webcreativeteam.com'
    );
  });
});
