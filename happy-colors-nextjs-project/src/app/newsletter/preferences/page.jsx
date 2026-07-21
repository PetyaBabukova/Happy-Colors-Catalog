import NewsletterPreferencesClient from './NewsletterPreferencesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Език на бюлетина | Happy Colors',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
};

export default function NewsletterPreferencesPage() {
  return <NewsletterPreferencesClient />;
}
