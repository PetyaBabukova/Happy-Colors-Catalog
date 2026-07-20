export const searchPageContent = {
  bg: {
    metadata: {
      title: '\u0422\u044a\u0440\u0441\u0435\u043d\u0435',
      description:
        '\u0420\u0435\u0437\u0443\u043b\u0442\u0430\u0442\u0438 \u043e\u0442 \u0442\u044a\u0440\u0441\u0435\u043d\u0435 \u0432 Happy Colors (\u0425\u0435\u043f\u0438 \u041a\u043e\u043b\u043e\u0440\u0441).',
    },
    resultsHeading: '\u0420\u0435\u0437\u0443\u043b\u0442\u0430\u0442\u0438 \u043e\u0442 \u0442\u044a\u0440\u0441\u0435\u043d\u0435\u0442\u043e \u043d\u0430: {query}',
  },
  en: {
    metadata: {
      title: 'Search',
      description: 'Search results from Happy Colors.',
    },
    resultsHeading: 'Search results for: {query}',
  },
};

export function getSearchPageContent(locale = 'bg') {
  return searchPageContent[locale] || searchPageContent.bg;
}
