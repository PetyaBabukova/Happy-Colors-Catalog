export const productsPageContent = {
  bg: {
    metadata: {
      title: {
        absolute: 'Ръчно плетени играчки, аксесоари и декорация за дома - каталог | Happy Colors',
      },
      description:
        '\u0420\u0430\u0437\u0433\u043b\u0435\u0434\u0430\u0439 \u0440\u044a\u0447\u043d\u043e \u0438\u0437\u0440\u0430\u0431\u043e\u0442\u0435\u043d\u0438 \u043f\u043b\u0435\u0442\u0435\u043d\u0438 \u0438\u0433\u0440\u0430\u0447\u043a\u0438, \u0430\u043a\u0441\u0435\u0441\u043e\u0430\u0440\u0438 \u0438 \u0434\u0435\u043a\u043e\u0440\u0430\u0446\u0438\u044f \u0437\u0430 \u0434\u043e\u043c\u0430 \u043e\u0442 Happy Colors (\u0425\u0435\u043f\u0438 \u041a\u043e\u043b\u043e\u0440\u0441) - \u0443\u043d\u0438\u043a\u0430\u043b\u043d\u0438 \u043c\u043e\u0434\u0435\u043b\u0438 \u0437\u0430 \u043f\u043e\u0434\u0430\u0440\u044a\u043a, \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u043d\u0438 \u043f\u043e\u0432\u043e\u0434\u0438 \u0438 \u0443\u044e\u0442\u0435\u043d \u0438\u043d\u0442\u0435\u0440\u0438\u043e\u0440.',
    },
  },
  en: {
    metadata: {
      title: {
        absolute: 'Handmade Crochet Toys, Bags & Home Decor - Catalog | Happy Colors',
      },
      description:
        'Shop available handmade crochet toys, accessories, and home decor from Happy Colors, with gift ideas for special occasions and cozy spaces.',
    },
  },
};

export function getProductsPageContent(locale = 'bg') {
  return productsPageContent[locale] || productsPageContent.bg;
}
