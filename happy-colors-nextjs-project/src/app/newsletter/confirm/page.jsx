import NewsletterConfirmClient from './NewsletterConfirmClient';

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
