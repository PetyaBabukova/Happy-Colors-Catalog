import HomepageFeaturedClient from './HomepageFeaturedClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Избери любими продукти',
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomepageFeaturedPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да управлявате продуктите на началната страница.">
      <HomepageFeaturedClient />
    </RequireAuth>
  );
}
