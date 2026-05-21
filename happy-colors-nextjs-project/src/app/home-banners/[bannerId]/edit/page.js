import EditHomeBannerClient from './EditHomeBannerClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Редактиране на хоум банер',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditHomeBannerPage({ params }) {
  return (
    <RequireAuth message="Трябва да сте логнати, за да редактирате homepage банер.">
      <EditHomeBannerClient params={params} />
    </RequireAuth>
  );
}
