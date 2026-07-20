import NewsletterConfirmClient from './NewsletterConfirmClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Потвърждение на абонамент | Happy Colors',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
};

export default function NewsletterConfirmPage() {
  return <NewsletterConfirmClient />;
}
