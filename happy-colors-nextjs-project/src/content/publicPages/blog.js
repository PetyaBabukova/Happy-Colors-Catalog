export const blogPageContent = {
  bg: {
    metadata: {
      title: '\u0411\u043b\u043e\u0433',
      description:
        'Истории и практични идеи от Happy Colors за handmade изделия, плетени играчки, детски подаръци, грижа и вдъхновение за личен жест.',
    },
    loadError:
      '\u0411\u043b\u043e\u0433 \u0441\u0442\u0430\u0442\u0438\u0438\u0442\u0435 \u043d\u0435 \u043c\u043e\u0433\u0430\u0442 \u0434\u0430 \u0431\u044a\u0434\u0430\u0442 \u0437\u0430\u0440\u0435\u0434\u0435\u043d\u0438 \u0432 \u043c\u043e\u043c\u0435\u043d\u0442\u0430.',
    detailError:
      '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0430\u0442\u0430 \u0431\u043b\u043e\u0433 \u0441\u0442\u0430\u0442\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435 \u0434\u0430 \u0431\u044a\u0434\u0435 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0430 \u0432 \u043c\u043e\u043c\u0435\u043d\u0442\u0430.',
    empty:
      '\u0412\u0441\u0435 \u043e\u0449\u0435 \u043d\u044f\u043c\u0430 \u043f\u0443\u0431\u043b\u0438\u043a\u0443\u0432\u0430\u043d\u0438 \u0431\u043b\u043e\u0433 \u0441\u0442\u0430\u0442\u0438\u0438.',
  },
  en: {
    metadata: {
      title: 'Blog',
      description:
        'Stories and practical ideas about handmade gifts, crochet toys, children’s presents, care tips and personalised gift inspiration from Happy Colors.',
    },
    loadError: 'Blog articles cannot be loaded at the moment.',
    detailError: 'The latest blog article cannot be shown at the moment.',
    empty: 'There are no published blog articles yet.',
  },
};

export function getBlogPageContent(locale = 'bg') {
  return blogPageContent[locale] || blogPageContent.bg;
}
