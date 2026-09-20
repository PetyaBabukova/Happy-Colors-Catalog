export const productsPageContent = {
  bg: {
    metadata: {
      title: {
        absolute: 'Ръчно плетени играчки, аксесоари и декорация за дома - каталог | Happy Colors',
      },
      description:
        'Разгледайте ръчно плетени играчки на една кука, меки животинки, аксесоари, чанти и декорация за дома от Happy Colors.',
    },
  },
  en: {
    metadata: {
      title: {
        absolute: 'Handmade Crochet Toys, Bags & Home Decor - Catalog | Happy Colors',
      },
    description:
      'Browse handmade crochet toys, soft crochet animals, bags, accessories and home decor from Happy Colors for gifts and cozy spaces.',
    },
  },
};

export function getProductsPageContent(locale = 'bg') {
  return productsPageContent[locale] || productsPageContent.bg;
}
