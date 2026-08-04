import { describe, expect, it } from 'vitest';
import {
  generateMetadata as generateConfirmMetadata,
} from '@/app/newsletter/confirm/page';
import {
  generateMetadata as generateLocalizedConfirmMetadata,
} from '@/app/(localized)/[locale]/newsletter/confirm/page';
import {
  generateMetadata as generateUnsubscribeMetadata,
} from '@/app/newsletter/unsubscribe/page';
import {
  generateMetadata as generateLocalizedUnsubscribeMetadata,
} from '@/app/(localized)/[locale]/newsletter/unsubscribe/page';
import {
  generateMetadata as generatePreferencesMetadata,
} from '@/app/newsletter/preferences/page';
import {
  generateMetadata as generateLocalizedPreferencesMetadata,
} from '@/app/(localized)/[locale]/newsletter/preferences/page';
import { getNewsletterLifecycleMetadata } from '@/content/publicPages/newsletter';
const noIndexMetadata = {
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
};

describe('newsletter lifecycle page metadata', () => {
  it.each([
    [generateConfirmMetadata, 'Потвърждение на абонамент'],
    [generateUnsubscribeMetadata, 'Отписване от новини'],
    [generatePreferencesMetadata, 'Език на бюлетина'],
  ])('uses Bulgarian metadata on the default route', async (generateMetadata, title) => {
    await expect(generateMetadata()).resolves.toEqual({
      title,
      ...noIndexMetadata,
    });
  });

  it.each([
    [generateConfirmMetadata, 'Confirm subscription'],
    [generateUnsubscribeMetadata, 'Unsubscribe from news'],
    [generatePreferencesMetadata, 'Newsletter language'],
    [generateLocalizedConfirmMetadata, 'Confirm subscription'],
    [generateLocalizedUnsubscribeMetadata, 'Unsubscribe from news'],
    [generateLocalizedPreferencesMetadata, 'Newsletter language'],
  ])('uses English metadata for localized routes', async (generateMetadata, title) => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({
      title,
      ...noIndexMetadata,
    });
  });

  it.each([
    ['confirm', 'Confirm subscription'],
    ['unsubscribe', 'Unsubscribe from news'],
    ['preferences', 'Newsletter language'],
  ])('builds English metadata for the %s page', (page, title) => {
    expect(getNewsletterLifecycleMetadata('en', page)).toEqual({
      title,
      ...noIndexMetadata,
    });
  });
});
