import { PROD_SITE_URL } from '@/config/siteSeo';
import { GIFT_GUIDE_SLUGS, GIFT_HUB_PATH } from '@/content/publicPages/gifts';
import { getEnabledPublicLocales } from '@/i18n/config';
import { localizePath } from '@/i18n/routing';

export const dynamic = 'force-static';

const PUBLIC_PATHS = Object.freeze([
  '/',
  '/products',
  GIFT_HUB_PATH,
  ...GIFT_GUIDE_SLUGS.map((slug) => `${GIFT_HUB_PATH}/${slug}`),
  '/faq',
  '/contacts',
  '/blog',
]);
const BLOCKED_PATH_PREFIXES = Object.freeze([
  '/admin',
  '/api',
  '/cart',
  '/cartoon-orders',
  '/checkout',
  '/users',
]);

function isAllowedPublicPath(path) {
  return !BLOCKED_PATH_PREFIXES.some((blockedPath) => (
    path === blockedPath || path.startsWith(`${blockedPath}/`)
  ));
}

function buildAbsoluteUrl(path) {
  return new URL(path, PROD_SITE_URL).toString();
}

function buildLocalizedUrls(paths, locales = getEnabledPublicLocales()) {
  return paths
    .filter(isAllowedPublicPath)
    .flatMap((path) => locales.map((locale) => buildAbsoluteUrl(localizePath(path, locale))));
}

export function buildLlmsTxt({
  paths = PUBLIC_PATHS,
  locales = getEnabledPublicLocales(),
} = {}) {
  const urls = buildLocalizedUrls(paths, locales);

  return [
    '# Happy Colors',
    '',
    'Happy Colors is a handmade crochet shop for colorful toys, accessories, decor, and thoughtful gift ideas.',
    '',
    '## Public Pages',
    ...urls.map((url) => `- ${url}`),
    '',
    '## Notes',
    '- The sitemap is available at https://happycolors.eu/sitemap.xml.',
    '- robots.txt controls crawler access; this file is only a concise public-page index.',
    '',
  ].join('\n');
}

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
