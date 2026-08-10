export function buildApiUrl(baseURL, path, params = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();

  return `${baseURL}${path}${query ? `?${query}` : ''}`;
}

export function getPublicServerFetchOptions({
  revalidate = 60,
  tags = [],
  browserNoStore = true,
} = {}) {
  if (browserNoStore && typeof window !== 'undefined') {
    return { cache: 'no-store' };
  }

  return {
    next: {
      revalidate,
      tags,
    },
  };
}
