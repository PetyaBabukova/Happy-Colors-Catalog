import NewsletterUnsubscribeClient from './NewsletterUnsubscribeClient';

export const metadata = {
  title: 'Отписване от новини | Happy Colors',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewsletterUnsubscribePage({ searchParams }) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';

  return <NewsletterUnsubscribeClient token={token} />;
}
