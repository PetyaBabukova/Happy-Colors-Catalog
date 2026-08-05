import { getSearchPageContent } from '@/content/publicPages/search';
import Shop from '../products/Shop';
import baseURL from '@/config';

function formatTemplate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const content = getSearchPageContent(params?.locale);

  return {
    ...content.metadata,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SearchPage({ params: paramsPromise, searchParams } = {}) {
  const routeParams = await paramsPromise;
  const locale = routeParams?.locale;
  const content = getSearchPageContent(locale);
  const params = await searchParams;
  const query = params?.q?.trim();

  let products = [];

  if (query) {
    try {
      const res = await fetch(
        `${baseURL}/search?${new URLSearchParams({
          q: query,
          ...(locale ? { locale } : {}),
        }).toString()}`,
        {
          cache: 'no-store',
        }
      );

      if (res.ok) {
        products = await res.json();
      }
    } catch (err) {
      console.error('Search request failed:', err.message);
    }
  }

  return (
    <>
      {query && <h1>{formatTemplate(content.resultsHeading, { query })}</h1>}
      <Shop products={products} showTitle={false} />
    </>
  );
}
