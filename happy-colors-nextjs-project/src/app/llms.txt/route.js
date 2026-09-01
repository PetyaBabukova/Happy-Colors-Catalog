import { PROD_SITE_URL, getLocalizedCanonicalPath, shouldExposeSitemap } from '@/config/siteSeo';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { GIFT_GUIDE_SLUGS, GIFT_HUB_PATH } from '@/content/publicPages/gifts';
import { DEFAULT_LOCALE, getEnabledPublicLocales, isLocaleRoutingEnabled } from '@/i18n/config';

export const dynamic = 'force-static';

const BLOCKED_PATH_PREFIXES = Object.freeze([
  '/admin',
  '/analytics',
  '/api',
  '/cart',
  '/cartoon-orders',
  '/categories',
  '/checkout',
  '/home-banners',
  '/homepage-featured',
  '/newsletter',
  '/translations',
  '/users',
]);
const PATH_LABELS = Object.freeze({
  '/': 'Homepage',
  '/products': 'Catalog',
  [GIFT_HUB_PATH]: 'Gift Guides',
  '/cartoons': 'Caricatures',
  '/cartoons/offer': 'Caricature Gift Offer',
  '/blog': 'Blog',
  '/faq': 'FAQ',
  '/contacts': 'Contacts',
  '/aboutus': 'About Happy Colors',
  '/partners': 'Partners',
});

function getPublicSections() {
  return [
    {
      title: 'Homepage',
      description: isCartoonsServiceEnabled
        ? 'Brand overview and entry point for handmade crochet toys, gifts, caricatures, and current featured content.'
        : 'Brand overview and entry point for handmade crochet toys, gifts, and current featured content.',
      paths: ['/'],
    },
    {
      title: 'Catalog',
      description: 'Available handmade crochet toys, accessories, and decor. Product detail pages are discoverable through the catalog and sitemap.',
      paths: ['/products'],
    },
    {
      title: 'Gift Guides',
      description: 'Editorial gift idea pages with shared English slugs across Bulgarian and English routes.',
      paths: [
        GIFT_HUB_PATH,
        ...GIFT_GUIDE_SLUGS.map((slug) => `${GIFT_HUB_PATH}/${slug}`),
      ],
    },
    ...(isCartoonsServiceEnabled
      ? [
          {
            title: 'Caricatures',
            description: 'Public caricature service pages for custom illustrated gifts.',
            paths: ['/cartoons', '/cartoons/offer'],
          },
        ]
      : []),
    {
      title: 'Blog And Help',
      description: 'Supporting articles, frequently asked questions, and contact information.',
      paths: ['/blog', '/faq', '/contacts'],
    },
    {
      title: 'About',
      description: 'Information about Happy Colors, the handmade work behind the catalog, and public partnership information.',
      paths: ['/aboutus', '/partners'],
    },
  ];
}

function isAllowedPublicPath(path) {
  return !BLOCKED_PATH_PREFIXES.some((blockedPath) => (
    path === blockedPath || path.startsWith(`${blockedPath}/`)
  ));
}

function buildAbsoluteUrl(path) {
  return new URL(path, PROD_SITE_URL).toString();
}

function getLlmsLocales() {
  return isLocaleRoutingEnabled() ? getEnabledPublicLocales() : [DEFAULT_LOCALE];
}

function titleCaseSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function getPathLabel(path) {
  if (PATH_LABELS[path]) {
    return PATH_LABELS[path];
  }

  if (path.startsWith(`${GIFT_HUB_PATH}/`)) {
    return titleCaseSlug(path.slice(`${GIFT_HUB_PATH}/`.length));
  }

  return path;
}

function buildLocalizedUrls(paths = [], locales = getLlmsLocales()) {
  return paths
    .filter(isAllowedPublicPath)
    .flatMap((path) => locales.map((locale) => ({
      label: `${isLocaleRoutingEnabled() ? `${locale.toUpperCase()} ` : ''}${getPathLabel(path)}`,
      url: buildAbsoluteUrl(getLocalizedCanonicalPath(path, locale)),
    })));
}

export function buildLlmsTxt({
  sections = getPublicSections(),
  paths,
  locales = getLlmsLocales(),
} = {}) {
  const visibleSections = Array.isArray(paths)
    ? [{ title: '', description: '', paths }]
    : sections;
  const introduction = isCartoonsServiceEnabled
    ? 'Happy Colors is a Bulgarian handmade studio for colorful crochet toys, accessories, decor, thoughtful gift ideas, and custom caricature gifts.'
    : 'Happy Colors is a Bulgarian handmade studio for colorful crochet toys, accessories, decor, and thoughtful gift ideas.';

  return [
    '# Happy Colors',
    '',
    introduction,
    '',
    'This file is a concise public-page index for AI assistants. It is not a crawler access-control file and does not replace robots.txt, sitemap.xml, structured data, or the visible website content.',
    '',
    '## Public Pages',
    ...visibleSections.flatMap((section) => {
      const urls = buildLocalizedUrls(section.paths, locales);

      if (!urls.length) {
        return [];
      }

      return [
        '',
        ...(section.title ? [`### ${section.title}`] : []),
        ...(section.description ? [section.description] : []),
        ...urls.map(({ label, url }) => `- [${label}](${url})`),
      ];
    }),
    '',
    '## Notes',
    `- The sitemap is available at ${buildAbsoluteUrl('/sitemap.xml')}.`,
    '- robots.txt controls crawler access. Follow robots.txt, page-level robots directives, and canonical URLs.',
    '- Do not treat cart, checkout, user account, admin, API, upload, or order-management URLs as public content for crawling or summarization.',
    '- Product and article detail pages should be discovered through the public catalog, blog, sitemap, and structured data.',
    '',
  ].join('\n');
}

export function GET() {
  if (!shouldExposeSitemap) {
    return new Response('', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
