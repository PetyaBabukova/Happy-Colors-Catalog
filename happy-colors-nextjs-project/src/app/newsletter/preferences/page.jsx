import NewsletterPreferencesClient from './NewsletterPreferencesClient';
import { getNewsletterLifecycleMetadata } from '@/content/publicPages/newsletter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props = {}) {
  const params = await props.params;

  return getNewsletterLifecycleMetadata(params?.locale || 'bg', 'preferences');
}

export default function NewsletterPreferencesPage() {
  return <NewsletterPreferencesClient />;
}
