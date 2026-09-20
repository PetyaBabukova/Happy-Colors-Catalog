import { DEFAULT_LOCALE } from '@/i18n/config';

const REVIEWED_CATEGORY_SEO_CONTENT = {
  'fairytale-characters': {
    bg: {
      heading: 'Плетени приказни герои',
      title: 'Плетени приказни герои и ръчно плетени кукли | Happy Colors',
      description:
        'Открийте плетени приказни герои и ръчно плетени кукли от Happy Colors – ръчно изработени играчки, създадени с внимание към всеки детайл.',
    },
    en: {
      heading: 'Crochet Fairytale Characters',
      title: 'Crochet Character Toys & Handmade Crochet Dolls | Happy Colors',
      description:
        'Discover crochet character toys and handmade crochet dolls by Happy Colors – unique storybook-inspired toys, carefully crafted with attention to detail.',
    },
  },
  'handmade-backpacks-and-bags': {
    bg: {
      heading: 'Ръчно изработени раници и чанти',
      title: 'Ръчно изработени раници и чанти | Happy Colors',
      description:
        'Разгледайте ръчно изработени раници и чанти от Happy Colors – плетени модели и стилни аксесоари, създадени с внимание към всеки детайл.',
    },
    en: {
      heading: 'Handmade Backpacks and Bags',
      title: 'Handmade Crochet Backpacks and Bags | Happy Colors',
      description:
        'Discover handmade crochet backpacks and bags by Happy Colors – unique, carefully crafted designs made with attention to every detail.',
    },
  },
  'crochet-animals': {
    bg: {
      heading: 'Плетени животинки',
      title: 'Плетени играчки животни и плетени животинки | Happy Colors',
      description:
        'Открийте плетени играчки животни и плетени животинки от Happy Colors – ръчно изработени модели, създадени с внимание към всеки детайл.',
    },
    en: {
      heading: 'Crochet Animals',
      title: 'Crochet Animal Toys & Handmade Crochet Animals | Happy Colors',
      description:
        'Discover crochet animal toys and handmade crochet animals by Happy Colors – charming soft toys, carefully crafted with attention to every detail.',
    },
  },
  'crochet-toy-backpack-sets': {
    bg: {
      heading: 'Комплекти с плетена играчка и раничка',
      title: 'Комплект плетена играчка с раничка | Happy Colors',
      description:
        'Разгледайте комплекти с плетена играчка и раничка от Happy Colors – оригинални детски комплекти, изработени с внимание към всеки детайл.',
    },
    en: {
      heading: 'Crochet Toy & Backpack Sets',
      title: 'Crochet Toy and Backpack Sets | Happy Colors',
      description:
        'Discover crochet toy and backpack sets by Happy Colors – charming handmade sets for kids, carefully crafted with attention to every detail.',
    },
  },
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getCategoryName(category) {
  return cleanText(category?.name) || cleanText(category?.displayNames?.bg) || 'Happy Colors';
}

function getCategorySlug(category) {
  return cleanText(category?.canonicalSlug || category?.filterSlug);
}

function getReviewedCategorySeoContent(category, locale) {
  const categorySlug = getCategorySlug(category);

  return REVIEWED_CATEGORY_SEO_CONTENT[categorySlug]?.[locale] || null;
}

function getCategoryAlternateLocales(category) {
  const eligibleLocales = Array.isArray(category?.eligibleLocales)
    ? category.eligibleLocales
    : [DEFAULT_LOCALE];

  return [...new Set(eligibleLocales.filter(Boolean))];
}

export function buildCategoryProductsMetadata(category, locale = DEFAULT_LOCALE) {
  const reviewedContent = getReviewedCategorySeoContent(category, locale);
  const categoryName = reviewedContent?.heading || getCategoryName(category);
  const categorySlug = getCategorySlug(category);
  const isEnglish = locale === 'en';
  const title = {
    absolute: reviewedContent?.title || `${categoryName} | Happy Colors`,
  };
  const fallbackDescription = isEnglish
    ? `Browse ${categoryName} from Happy Colors, with handmade catalog pieces shown from real product listings.`
    : `Разгледайте ${categoryName} от Happy Colors с ръчно изработени предложения от каталога.`;
  const description = reviewedContent?.description || fallbackDescription;
  const alternateLocales = getCategoryAlternateLocales(category);

  return {
    title,
    description,
    path: `/products?category=${encodeURIComponent(categorySlug)}`,
    locale,
    alternateLocales,
    includeXDefault: alternateLocales.includes(DEFAULT_LOCALE),
  };
}

export function buildCategoryProductsPageContent(category, locale = DEFAULT_LOCALE) {
  const reviewedContent = getReviewedCategorySeoContent(category, locale);

  return {
    heading: reviewedContent?.heading || getCategoryName(category),
  };
}
