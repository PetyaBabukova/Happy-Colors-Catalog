'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProductForm from '@/components/products/ProductForm';
import MessageBox from '@/components/ui/MessageBox';
import TranslationDecisionModal from '@/components/translations/TranslationDecisionModal';
import {
  canRequestPublicProductRevalidation,
  onEditProductSubmit,
  revalidatePublicProductSurfaces,
} from '@/managers/productsManager';
import { acceptCurrentTranslation, generateTranslation } from '@/managers/translationsManager';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { checkProductAccess } from '@/utils/checkProductAccess';

export default function EditProductClient({ params }) {
  const { productId } = typeof params?.then === 'function' ? use(params) : params;
  const { user } = useAuth();
  const router = useRouter();
  const { publicHref } = useLocaleNavigation();

  const [product, setProduct] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [translationDecision, setTranslationDecision] = useState(null);
  const [translationDecisionLoading, setTranslationDecisionLoading] = useState('');
  const [translationDecisionError, setTranslationDecisionError] = useState('');

  useEffect(() => {
    if (user === undefined) return;

    checkProductAccess(productId, user).then(({ product, unauthorized, error: accessError }) => {
      const normalizedProduct = product
        ? { ...product, availability: product.availability || 'available' }
        : product;

      setProduct(normalizedProduct);
      setUnauthorized(unauthorized);
      if (accessError) {
        setError('Грешка при зареждане на продукта.');
      }
      setLoading(false);
    });
  }, [productId, user]);

  const navigateToProduct = () => {
    router.push(publicHref(`/products/${productId}`));
    router.refresh();
  };

  const handleTranslationDecision = async (action) => {
    if (!translationDecision) {
      return;
    }

    const mutation = action === 'yes' ? generateTranslation : acceptCurrentTranslation;

    try {
      setTranslationDecisionLoading(action);
      setTranslationDecisionError('');
      await mutation({
        entityType: 'product',
        entityId: productId,
        locale: translationDecision.locale || 'en',
        expectedSourceRevision: translationDecision.sourceRevision,
        expectedTranslationRevision: translationDecision.translationRevision,
      });
      if (canRequestPublicProductRevalidation(user)) {
        await revalidatePublicProductSurfaces(productId);
      }
      setTranslationDecision(null);
      navigateToProduct();
    } catch (decisionError) {
      setTranslationDecisionError(
        decisionError?.message || 'English translation decision was not saved.'
      );
    } finally {
      setTranslationDecisionLoading('');
    }
  };

  const finishWithoutTranslationDecision = () => {
    setTranslationDecision(null);
    navigateToProduct();
  };

  if (user === undefined || loading) return <p>Зареждане...</p>;

  if (unauthorized) {
    return <MessageBox type="error" message="Нямате права да редактирате този продукт." />;
  }

  if (error) {
    return <MessageBox type="error" message={error} />;
  }

  return (
    <>
      {translationDecision && (
        <TranslationDecisionModal
          decision={translationDecision}
          entityLabel="product"
          busyAction={translationDecisionLoading}
          error={translationDecisionError}
          onYes={() => handleTranslationDecision('yes')}
          onNo={() => handleTranslationDecision('no')}
          onDismiss={finishWithoutTranslationDecision}
        />
      )}
      <ProductForm
        initialValues={product}
        onSubmit={(values, setSuccess, setError, setInvalidFields) =>
          onEditProductSubmit(
            values,
            setSuccess,
            setError,
            setInvalidFields,
            user,
            router,
            productId,
            {
              publicHref,
              onTranslationDecision: (decision) => {
                setTranslationDecisionError('');
                setTranslationDecision(decision);
              },
            }
          )
        }
        legendText="Редактиране на продукта"
        successMessage="Продуктът беше редактиран успешно!"
        canManageGalleryFlags={user?.role === 'full_admin'}
        translationHref={
          user?.role === 'full_admin'
            ? `/translations?entityType=product&entityId=${encodeURIComponent(productId)}`
            : ''
        }
      />
    </>
  );
}
