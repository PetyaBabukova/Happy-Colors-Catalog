'use client';

import { use, useEffect, useState } from 'react';
import MessageBox from '@/components/ui/MessageBox';
import HomeBannerForm from '@/components/home-banners/HomeBannerForm';
import { useAuth } from '@/context/AuthContext';
import { editHomeBanner, getHomeBannerById } from '@/managers/homeBannersManager';

export default function EditHomeBannerClient({ params }) {
  const { bannerId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    getHomeBannerById(bannerId)
      .then((loadedBanner) => {
        if (isMounted) {
          setBanner(loadedBanner);
          setError('');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Неуспешно зареждане на homepage банера.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, bannerId, user]);

  if (authLoading || loading) {
    return <p>Зареждане...</p>;
  }

  if (!user) {
    return <MessageBox type="error" message="Трябва да сте логнати, за да редактирате homepage банер." />;
  }

  if (error) {
    return <MessageBox type="error" message={error} />;
  }

  return (
    <HomeBannerForm
      initialValues={banner}
      onSubmit={(values) => editHomeBanner(bannerId, values, { previousPlacement: banner?.placement })}
      legendText="Редактиране на хоум банер"
      successMessage="Хоум банерът беше редактиран успешно."
    />
  );
}
