'use client';

import ProductForm from '@/components/products/ProductForm';
import { onCreateProductSubmit } from '@/managers/productsManager';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';

export default function CreateProductClient() {
  const { user } = useAuth();
  const { triggerCategoriesReload } = useProducts();
  const { publicHref } = useLocaleNavigation();

  return (
    <ProductForm
      initialValues={{
        title: '',
        description: '',
        category: '',
        price: '',
        imageUrl: '',
        imageUrls: [],
        videos: [],
        availability: 'available',
        isInCatalog: false,
        isCartoonGallery: false,
      }}
      canManageGalleryFlags={user?.role === 'full_admin'}
      onSubmit={(values, setSuccess, setError, setInvalidFields, router) =>
        onCreateProductSubmit(
          values,
          setSuccess,
          setError,
          setInvalidFields,
          user,
          router,
          triggerCategoriesReload,
          { publicHref }
        )
      }
      legendText="Създаване на нов продукт"
      successMessage="Продуктът беше създаден успешно!"
    />
  );
}
