import CreateHomeBannerClient from './CreateHomeBannerClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Създай хоум банер',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateHomeBannerPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да създадете homepage банер.">
      <CreateHomeBannerClient />
    </RequireAuth>
  );
}
