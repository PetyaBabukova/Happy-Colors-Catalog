import NewsletterConfirmClient from './NewsletterConfirmClient';
import { getNewsletterLifecycleMetadata } from '@/content/publicPages/newsletter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props = {}) {
  const params = await props.params;

  return getNewsletterLifecycleMetadata(params?.locale || 'bg', 'confirm');
}

export default function NewsletterConfirmPage() {
  return <NewsletterConfirmClient />;
}
