import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  readConsentCookie,
} from '@/config/cookieConsent';
import I18nProvider from '@/i18n/I18nProvider';
import { getDictionary } from '@/i18n/getDictionary';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import CookieConsentBanner from '@/components/privacy/CookieConsentBanner';
import CookieFooterLink from '@/components/privacy/CookieFooterLink';

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
}

function setConsentCookie(value) {
  document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(
    JSON.stringify(value)
  )}; Path=/`;
}

function renderConsentUi(locale = 'bg') {
  return render(
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <CookieConsentProvider>
        <CookieFooterLink />
        <CookieConsentBanner />
      </CookieConsentProvider>
    </I18nProvider>
  );
}

describe('Cookie consent UI', () => {
  afterEach(() => {
    clearConsentCookie();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows the banner on first visit', async () => {
    renderConsentUi();

    expect(await screen.findByLabelText('Известие за бисквитки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Приемам всички' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Само необходими' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Настройки' })).toBeInTheDocument();
  });

  it('renders the cookie banner and settings in English without resetting consent state', async () => {
    renderConsentUi('en');

    expect(await screen.findByLabelText('Cookie notice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument();
    expect(screen.queryByText('Приемам всички')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cookie settings' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Analytics/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Necessary only' }));

    await waitFor(() => {
      expect(readConsentCookie(document.cookie)).toMatchObject({
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });
  });

  it('accepts all optional categories and hides the banner', async () => {
    renderConsentUi();

    fireEvent.click(await screen.findByRole('button', { name: 'Приемам всички' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Известие за бисквитки')).not.toBeInTheDocument();
    });
    expect(readConsentCookie(document.cookie)).toMatchObject({
      necessary: true,
      analytics: true,
      marketing: true,
    });
  });

  it('stores only necessary consent', async () => {
    renderConsentUi();

    fireEvent.click(await screen.findByRole('button', { name: 'Само необходими' }));

    await waitFor(() => {
      expect(readConsentCookie(document.cookie)).toMatchObject({
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });
  });

  it('saves custom settings', async () => {
    renderConsentUi();

    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }));
    const dialog = await screen.findByRole('dialog', { name: 'Настройки за бисквитки' });

    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Аналитични/i));
    fireEvent.click(screen.getByRole('button', { name: 'Запази избора' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Настройки за бисквитки' })).not.toBeInTheDocument();
    });
    expect(readConsentCookie(document.cookie)).toMatchObject({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });

  it('reopens settings from the footer after consent is stored', async () => {
    renderConsentUi();

    fireEvent.click(await screen.findByRole('button', { name: 'Само необходими' }));
    fireEvent.click(screen.getByRole('button', { name: 'Бисквитки и настройки за поверителност' }));

    expect(await screen.findByRole('dialog', { name: 'Настройки за бисквитки' })).toBeInTheDocument();
  });

  it('ignores corrupt stored consent and shows the banner again', async () => {
    document.cookie = `${COOKIE_CONSENT_NAME}=bad-value; Path=/`;

    renderConsentUi();

    expect(await screen.findByLabelText('Известие за бисквитки')).toBeInTheDocument();
  });

  it('treats stored accept-all consent as optional-off when GPC is present', async () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      configurable: true,
      value: true,
    });
    setConsentCookie({
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    });

    renderConsentUi();
    fireEvent.click(screen.getByRole('button', { name: 'Бисквитки и настройки за поверителност' }));

    const analyticsToggle = await screen.findByLabelText(/Аналитични/i);
    const marketingToggle = screen.getByLabelText(/Маркетингови/i);

    expect(analyticsToggle).not.toBeChecked();
    expect(marketingToggle).not.toBeChecked();
  });

  it('shows policy details as an inline section inside settings', async () => {
    renderConsentUi();

    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Политика за бисквитки' }));

    expect(screen.getByLabelText('Политика за бисквитки')).toBeInTheDocument();
    expect(screen.getByText(/happy\.colors\.bg@gmail\.com/i)).toBeInTheDocument();
  });
});
