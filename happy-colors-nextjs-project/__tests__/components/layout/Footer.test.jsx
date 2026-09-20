import { describe, expect, it, vi } from 'vitest';
import Footer from '@/components/layout/Footer';
import { render, screen, within } from '../test-utils.jsx';

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
    expect(screen.getByRole('link', { name: 'Идеи за подарък' })).toHaveAttribute('href', '/gifts');
    expect(screen.getByText('Последвайте ни:')).toBeInTheDocument();
    const socialNav = screen.getByRole('navigation', { name: 'Социални профили' });

    expect(within(socialNav).getAllByRole('link')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Facebook/ })).toHaveAttribute(
      'href',
      'https://www.facebook.com/happycolors.studio'
    );
    expect(screen.getByRole('link', { name: /Instagram/ })).toHaveAttribute(
      'href',
      'https://www.instagram.com/happycolors.crochet/'
    );
    expect(screen.getByRole('link', { name: /Etsy/ })).toHaveAttribute(
      'href',
      'https://happycolorsartshop.etsy.com/'
    );
    expect(screen.getByRole('link', { name: /YouTube/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/@HappyColorsCrochet'
    );
    expect(screen.getByRole('link', { name: /TikTok/ })).toHaveAttribute(
      'href',
      'https://www.tiktok.com/@happycolorscrochet'
    );
    expect(screen.getByRole('link', { name: /webcreativeteam\.com/ })).toHaveAttribute(
      'href',
      'https://webcreativeteam.com'
    );
  });
});
