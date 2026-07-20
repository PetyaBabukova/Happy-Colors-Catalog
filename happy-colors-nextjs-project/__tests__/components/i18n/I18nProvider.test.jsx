import { afterEach, describe, expect, it, vi } from 'vitest';
import I18nProvider from '@/i18n/I18nProvider';
import useTranslations from '@/i18n/useTranslations';
import { formatMessage, getDictionary } from '@/i18n/getDictionary';
import { render, screen } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

function Probe() {
  const { t, formatVisibleDate } = useTranslations('products');

  return (
    <div>
      <p>{t('priceInquiry', { price: '18' })}</p>
      <time dateTime="2026-07-04">{formatVisibleDate('2026-07-04')}</time>
    </div>
  );
}

describe('I18nProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a selected client dictionary through the translation hook', () => {
    render(
      <I18nProvider locale="en" dictionary={getDictionary('en')}>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByText('Price 18 €. For availability and details, please send an inquiry.')).toBeInTheDocument();
    expect(screen.getByText('04.07.2026')).toHaveAttribute('dateTime', '2026-07-04');
  });

  it('uses the active localized URL dictionary when client navigation changes locale', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/bg/products' });

    render(
      <I18nProvider locale="en" dictionary={getDictionary('en')}>
        <Probe />
      </I18nProvider>,
      { locale: 'en' }
    );

    expect(
      screen.getByText(formatMessage(getDictionary('bg'), 'products.priceInquiry', { price: '18' }))
    ).toBeInTheDocument();
  });
});
