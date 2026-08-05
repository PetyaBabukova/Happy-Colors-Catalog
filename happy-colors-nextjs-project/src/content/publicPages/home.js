export const homePageContent = {
  bg: {
    metadata: {
      title: {
        absolute: '\u041f\u043b\u0435\u0442\u0435\u043d\u0438 \u0438\u0433\u0440\u0430\u0447\u043a\u0438, \u0430\u043a\u0441\u0435\u0441\u043e\u0430\u0440\u0438 \u0438 \u0434\u0435\u043a\u043e\u0440\u0430\u0446\u0438\u044f \u0437\u0430 \u0434\u043e\u043c\u0430 | Happy Colors | \u0425\u0435\u043f\u0438 \u041a\u043e\u043b\u043e\u0440\u0441',
      },
      description:
        '\u0420\u044a\u0447\u043d\u043e \u0438\u0437\u0440\u0430\u0431\u043e\u0442\u0435\u043d\u0438 \u043f\u043b\u0435\u0442\u0435\u043d\u0438 \u0438\u0433\u0440\u0430\u0447\u043a\u0438, \u0430\u043a\u0441\u0435\u0441\u043e\u0430\u0440\u0438 \u0438 \u0434\u0435\u043a\u043e\u0440\u0430\u0446\u0438\u044f \u0437\u0430 \u0434\u043e\u043c\u0430 \u043e\u0442 Happy Colors (\u0425\u0435\u043f\u0438 \u041a\u043e\u043b\u043e\u0440\u0441) - \u0438\u0434\u0435\u0438 \u0437\u0430 \u043f\u043e\u0434\u0430\u0440\u044a\u043a, \u0443\u044e\u0442 \u0438 \u043a\u0440\u0430\u0441\u0438\u0432\u0438 \u0438\u0437\u0434\u0435\u043b\u0438\u044f \u0441 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440.',
    },
    intro: {
      title: 'Ръчно изработени плетени играчки, аксесоари и декорация за дома',
      text: 'В Happy Colors ще откриете ръчно изработени плетени играчки, аксесоари и декорация за дома, създадени с внимание към всеки детайл. Колекцията включва красиви и оригинални изделия, подходящи за подарък, детска стая, празник или уютен акцент у дома. Ако нещо ви хареса, можете да се свържете с мен за наличност, въпроси и поръчка. Разгледайте галерията и открийте изделие с характер, изработено с грижа и стил.',
    },
    favoritesTitle: 'Най-любимите ви продукти',
    faqLinkLabel: 'Често задавани въпроси',
  },
  en: {
    metadata: {
      title: {
        absolute: 'Handmade Crochet Toys, Accessories, And Home Decor | Happy Colors',
      },
      description:
        'Handmade crochet toys, accessories, and home decorations by Happy Colors - original gift ideas, cozy accents, and beautiful pieces with character.',
    },
    intro: {
      title: 'Handmade crochet toys, accessories, and home decor',
      text: 'At Happy Colors you will find handmade crochet toys, accessories, and home decorations created with attention to every detail. The collection includes beautiful and original pieces for gifts, children’s rooms, holidays, or a cozy accent at home. If something catches your eye, you can contact me about availability, questions, or a custom request. Browse the gallery and discover a piece with character, made with care and style.',
    },
    favoritesTitle: 'Your favorite products',
    faqLinkLabel: 'Frequently asked questions',
  },
};

export function getHomePageContent(locale = 'bg') {
  return homePageContent[locale] || homePageContent.bg;
}
