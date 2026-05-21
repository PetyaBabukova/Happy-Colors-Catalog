import { Suspense } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
import NewsletterSendClient from './NewsletterSendClient';

export const metadata = {
  title: 'Изпращане на новини',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewsletterSendPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да изпратите новини до абонатите.">
      <Suspense fallback={null}>
        <NewsletterSendClient />
      </Suspense>
    </RequireAuth>
  );
}
