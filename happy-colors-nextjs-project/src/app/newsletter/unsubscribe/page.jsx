import NewsletterUnsubscribeClient from './NewsletterUnsubscribeClient';
import { getNewsletterLifecycleMetadata } from '@/content/publicPages/newsletter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props = {}) {
  const params = await props.params;

  return getNewsletterLifecycleMetadata(params?.locale || 'bg', 'unsubscribe');
}

export default async function NewsletterUnsubscribePage({ searchParams }) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';

  return <NewsletterUnsubscribeClient token={token} />;
}
