'use client';

import MessageBox from '@/components/ui/MessageBox';
import HomeBannerForm from '@/components/home-banners/HomeBannerForm';
import { useAuth } from '@/context/AuthContext';
import { createHomeBanner } from '@/managers/homeBannersManager';

export default function CreateHomeBannerClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Зареждане...</p>;
  }

  if (!user) {
    return <MessageBox type="error" message="Трябва да сте логнати, за да създадете homepage банер." />;
  }

  return (
    <HomeBannerForm
      onSubmit={createHomeBanner}
      legendText="Създаване на хоум банер"
      successMessage="Хоум банерът беше създаден успешно."
    />
  );
}
