'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProductForm from '@/components/products/ProductForm';
import MessageBox from '@/components/ui/MessageBox';
import { onEditProductSubmit } from '@/managers/productsManager';
import { checkProductAccess } from '@/utils/checkProductAccess';

export default function EditProductClient({ params }) {
  const { productId } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;

    checkProductAccess(productId, user).then(({ product, unauthorized, error: accessError }) => {
      // ✅ ако продуктът е стар и няма availability → default
      const normalizedProduct = product
        ? { availability: 'available', ...product, availability: product.availability || 'available' }
        : product;

      setProduct(normalizedProduct);
      setUnauthorized(unauthorized);
      if (accessError) {
        setError('Грешка при зареждане на продукта.');
      }
      setLoading(false);
    });
  }, [productId, user]);

  if (user === undefined || loading) return <p>Зареждане...</p>;

  if (unauthorized) {
    return <MessageBox type="error" message="Нямате права да редактирате този продукт." />;
  }

  if (error) {
    return <MessageBox type="error" message={error} />;
  }

  return (
    <ProductForm
      initialValues={product}
      onSubmit={(values, setSuccess, setError, setInvalidFields) =>
        onEditProductSubmit(values, setSuccess, setError, setInvalidFields, user, router, productId)
      }
      legendText="Редактиране на продукта"
      successMessage="Продуктът беше редактиран успешно!"
      canManageGalleryFlags={user?.role === 'full_admin'}
    />
  );
}
