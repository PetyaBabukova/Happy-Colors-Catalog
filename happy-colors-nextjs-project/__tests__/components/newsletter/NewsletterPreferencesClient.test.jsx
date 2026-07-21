import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterPreferencesClient from '@/app/newsletter/preferences/NewsletterPreferencesClient';
import {
  exchangeNewsletterPreferencesToken,
  updateNewsletterPreferences,
} from '@/managers/newsletterManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  exchangeNewsletterPreferencesToken: vi.fn(),
  updateNewsletterPreferences: vi.fn(),
}));

function setPreferencesUrl(hash = '') {
  window.history.pushState(null, '', `/newsletter/preferences${hash}`);
}

describe('NewsletterPreferencesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeNewsletterPreferencesToken.mockResolvedValue({
      sessionToken: 'session-1',
      currentLocale: 'bg',
      supportedLocales: ['bg', 'en'],
    });
    updateNewsletterPreferences.mockResolvedValue({
      message: 'saved',
      currentLocale: 'en',
    });
    setPreferencesUrl('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows an invalid-link state when the token is missing', async () => {
    render(<NewsletterPreferencesClient />, { locale: 'en' });

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
    expect(screen.getByText('This newsletter preferences link is invalid or incomplete.')).toBeInTheDocument();
    expect(exchangeNewsletterPreferencesToken).not.toHaveBeenCalled();
  });

  it('exchanges the fragment token on mount and strips it from the visible URL', async () => {
    setPreferencesUrl('#token=preferences-token');

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    await waitFor(() => {
      expect(exchangeNewsletterPreferencesToken).toHaveBeenCalledWith('preferences-token');
    });
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Current newsletter language: Bulgarian')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Preferred newsletter language' })).toHaveValue('bg');
  });

  it('preserves search params while stripping the fragment token', async () => {
    window.history.pushState(null, '', '/newsletter/preferences?source=email#token=preferences-token');

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    expect(window.location.pathname).toBe('/newsletter/preferences');
    expect(window.location.search).toBe('?source=email');
    expect(window.location.hash).toBe('');
  });

  it('keeps the stripped fragment token available during StrictMode effect replay', async () => {
    setPreferencesUrl('#token=preferences-token');

    render(
      <StrictMode>
        <NewsletterPreferencesClient />
      </StrictMode>,
      { locale: 'en' }
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Preferred newsletter language' })).toHaveValue('bg');
    });
    expect(window.location.hash).toBe('');
    expect(exchangeNewsletterPreferencesToken).toHaveBeenCalledTimes(1);
    expect(exchangeNewsletterPreferencesToken).toHaveBeenCalledWith('preferences-token');
  });

  it('uses supported locales returned by the exchange response', async () => {
    setPreferencesUrl('#token=preferences-token');
    exchangeNewsletterPreferencesToken.mockResolvedValueOnce({
      sessionToken: 'session-1',
      currentLocale: 'fr',
      supportedLocales: ['en'],
    });

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    const select = await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    expect(select).toHaveValue('en');
    expect(screen.queryByRole('option', { name: 'Bulgarian' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByText('Current newsletter language: English')).toBeInTheDocument();
  });

  it('falls back to the default locale when the current locale is unsupported', async () => {
    setPreferencesUrl('#token=preferences-token');
    exchangeNewsletterPreferencesToken.mockResolvedValueOnce({
      sessionToken: 'session-1',
      currentLocale: 'fr',
      supportedLocales: ['bg', 'en'],
    });

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    const select = await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    expect(select).toHaveValue('bg');
    expect(screen.getByText('Current newsletter language: Bulgarian')).toBeInTheDocument();
  });

  it('updates the selected newsletter language with the short-lived session token', async () => {
    setPreferencesUrl('#token=preferences-token');

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    const select = await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    fireEvent.change(select, { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => {
      expect(updateNewsletterPreferences).toHaveBeenCalledWith({
        sessionToken: 'session-1',
        locale: 'en',
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Your newsletter language has been updated.');
    expect(screen.getByText('Current newsletter language: English')).toBeInTheDocument();
  });

  it('clears a saved message when the selected locale changes again', async () => {
    setPreferencesUrl('#token=preferences-token');

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    const select = await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    fireEvent.change(select, { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await screen.findByText('Your newsletter language has been updated.');
    fireEvent.change(select, { target: { value: 'bg' } });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows localized generic copy when saving fails', async () => {
    setPreferencesUrl('#token=preferences-token');
    updateNewsletterPreferences.mockRejectedValueOnce(new Error('backend-only-error'));

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    const select = await screen.findByRole('combobox', { name: 'Preferred newsletter language' });
    fireEvent.change(select, { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('We could not update your newsletter language.');
    });
    expect(screen.getByRole('status')).not.toHaveTextContent('backend-only-error');
  });

  it('shows localized generic copy when the exchange fails', async () => {
    setPreferencesUrl('#token=bad-token');
    exchangeNewsletterPreferencesToken.mockRejectedValueOnce(new Error('backend-only-error'));

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    await waitFor(() => {
      expect(exchangeNewsletterPreferencesToken).toHaveBeenCalledWith('bad-token');
    });
    expect(screen.getByRole('status')).toHaveTextContent('We could not load your newsletter preferences.');
    expect(screen.getByRole('status')).not.toHaveTextContent('backend-only-error');
  });

  it('shows localized generic copy when the exchange response omits a session token', async () => {
    setPreferencesUrl('#token=bad-token');
    exchangeNewsletterPreferencesToken.mockResolvedValueOnce({
      currentLocale: 'bg',
      supportedLocales: ['bg', 'en'],
    });

    render(<NewsletterPreferencesClient />, { locale: 'en' });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('We could not load your newsletter preferences.');
    });
    expect(screen.queryByText('This newsletter preferences link is invalid or incomplete.')).not.toBeInTheDocument();
  });
});
