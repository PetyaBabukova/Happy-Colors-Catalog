import Shop from '../products/Shop';
import baseURL from '@/config';

export const metadata = {
  title: 'Търсене',
  description: 'Резултати от търсене в Happy Colors (Хепи Колорс).',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = params?.q?.trim();

  let products = [];

  if (query) {
    try {
      const res = await fetch(
        `${baseURL}/search?q=${encodeURIComponent(query)}`,
        {
          cache: 'no-store',
        }
      );

      if (res.ok) {
        products = await res.json();
      }
    } catch (err) {
      console.error('Грешка при търсенето:', err.message);
    }
  }

  return (
    <>
      {query && <h1>Резултати от търсенето на: {query}</h1>}
      <Shop products={products} />
    </>
  );
}
