export const E2E_LOCAL_NEWSLETTER_UNSUBSCRIBE_SECRET = 'local-e2e-newsletter-unsubscribe-secret';

export function getE2eRuntimeSettings(env = process.env) {
  const port = Number(env.PORT || 3100);
  const baseURL = env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
  const catalogMode = env.CATALOG_MODE || 'false';
  const publicCatalogMode = env.NEXT_PUBLIC_CATALOG_MODE || catalogMode;
  const localeRoutesEnabled = env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED || 'true';
  const englishLocaleEnabled = env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED || 'true';
  const newsletterUnsubscribeSecret = env.NEWSLETTER_UNSUBSCRIBE_SECRET ||
    E2E_LOCAL_NEWSLETTER_UNSUBSCRIBE_SECRET;

  return {
    baseURL,
    catalogMode,
    englishLocaleEnabled,
    localeRoutesEnabled,
    newsletterUnsubscribeSecret,
    port,
    publicCatalogMode,
  };
}

export function buildE2eServerEnv(env, settings) {
  return {
    ...env,
    NODE_ENV: 'test',
    PORT: String(settings.port),
    CATALOG_MODE: settings.catalogMode,
    NEXT_PUBLIC_CATALOG_MODE: settings.publicCatalogMode,
    NEXT_PUBLIC_LOCALE_ROUTES_ENABLED: settings.localeRoutesEnabled,
    NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED: settings.englishLocaleEnabled,
    NEXT_PUBLIC_SITE_URL: settings.baseURL,
    RENDER_EXTERNAL_URL: settings.baseURL,
    CLIENT_URL: settings.baseURL,
    ALLOWED_ORIGINS: settings.baseURL,
    DISABLE_EMAIL_DELIVERY: 'true',
    NEWSLETTER_UNSUBSCRIBE_SECRET: settings.newsletterUnsubscribeSecret,
  };
}
