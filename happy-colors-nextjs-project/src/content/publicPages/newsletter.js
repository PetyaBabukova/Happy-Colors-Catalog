import { getDictionary } from '@/i18n/getDictionary';

const DICTIONARY_SECTION_BY_PAGE = Object.freeze({
  confirm: 'confirmPage',
  unsubscribe: 'unsubscribePage',
  preferences: 'preferences',
});

export function getNewsletterLifecycleMetadata(locale = 'bg', page) {
  const dictionarySection = DICTIONARY_SECTION_BY_PAGE[page];

  if (!dictionarySection) {
    throw new Error(`Unsupported newsletter lifecycle page: ${String(page)}`);
  }

  const dictionary = getDictionary(locale);

  return {
    title: dictionary.newsletter[dictionarySection].title,
    robots: {
      index: false,
      follow: false,
    },
    referrer: 'no-referrer',
  };
}
