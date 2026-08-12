function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function toRevalidateUrl(value, endpointPath) {
  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase().endsWith(endpointPath.toLowerCase())) {
    return normalized;
  }

  return `${normalized}${endpointPath}`;
}

function getEnvList(names) {
  return names
    .flatMap((name) => String(process.env[name] || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createRevalidateSurfaceHelpers({
  surfaceName,
  endpointPath,
  urlEnvNames = [],
  secretEnvNames = [],
  buildBody = () => ({}),
  shouldSkip = () => false,
  missingConfigurationMessage,
} = {}) {
  function buildRevalidateUrls() {
    const explicitUrls = getEnvList(urlEnvNames)
      .map((value) => toRevalidateUrl(value, endpointPath))
      .filter(Boolean);
    const inferredUrls = [
      process.env.CLIENT_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEWSLETTER_PUBLIC_SITE_URL,
      process.env.PUBLIC_SITE_URL,
    ]
      .map((value) => toRevalidateUrl(value, endpointPath))
      .filter(Boolean);

    return [...new Set([...explicitUrls, ...inferredUrls])];
  }

  function getRevalidateSecret() {
    for (const envName of secretEnvNames) {
      const secret = String(process.env[envName] || '').trim();

      if (secret) {
        return secret;
      }
    }

    return '';
  }

  async function revalidateSurfaces(options = {}) {
    const urls = buildRevalidateUrls();
    const secret = getRevalidateSecret();

    if (shouldSkip(options)) {
      return { skipped: true };
    }

    if (urls.length === 0 || !secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(missingConfigurationMessage);
      }

      return { skipped: true };
    }

    if (typeof fetch !== 'function') {
      return { skipped: true };
    }

    const body = JSON.stringify(buildBody(options));
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-revalidate-secret': secret,
            },
            body,
          });

          return { url, ok: response.ok, status: response.status };
        } catch (error) {
          console.error(`Failed to revalidate ${surfaceName} surfaces:`, error?.message || error);
          return { url, ok: false, error: true };
        }
      })
    );

    return {
      ok: results.every((result) => result.ok),
      results,
    };
  }

  async function revalidateSurfacesSafely(options = {}) {
    try {
      return await revalidateSurfaces(options);
    } catch (error) {
      console.error(`Failed to revalidate ${surfaceName} surfaces:`, error?.message || error);
      return { ok: false, error: true };
    }
  }

  return {
    revalidateSurfaces,
    revalidateSurfacesSafely,
  };
}
