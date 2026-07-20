'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sanitizeText } from '@/utils/formValidations';
import { handleSubmit } from '@/utils/formSubmitHelper';
import useForm from '@/hooks/useForm';
import {
  createResponseError,
  extractErrorMessage,
  readResponseJsonSafely,
} from '@/utils/errorHandler';
import MessageBox from '@/components/ui/MessageBox';
import TranslationDecisionModal from '@/components/translations/TranslationDecisionModal';
import { acceptCurrentTranslation, generateTranslation } from '@/managers/translationsManager';
import baseURL from '@/config';
import styles from '@/components/products/create.module.css';
import { useProducts } from '@/context/ProductContext';

export default function EditCategoryClient() {
  const { categoryId } = useParams();
  const router = useRouter();
  const { triggerCategoriesReload } = useProducts();

  const {
    formValues,
    setFormValues,
    error,
    setError,
    success,
    setSuccess,
    invalidFields,
    setInvalidFields,
    handleChange,
  } = useForm({
    name: '',
    canonicalSlug: '',
    canonicalSlugReviewed: false,
  });

  const [loading, setLoading] = useState(true);
  const [slugAliasesInput, setSlugAliasesInput] = useState('');
  const [translationDecision, setTranslationDecision] = useState(null);
  const [translationDecisionLoading, setTranslationDecisionLoading] = useState('');
  const [translationDecisionError, setTranslationDecisionError] = useState('');

  useEffect(() => {
    async function fetchCategory() {
      try {
        const res = await fetch(`${baseURL}/categories/${categoryId}`, {
          credentials: 'include',
        });

        const data = await readResponseJsonSafely(res);

        if (!res.ok) {
          throw createResponseError(
            data?.message || 'Грешка при зареждане на категорията.',
            data
          );
        }

        setFormValues({
          name: data?.name || '',
          canonicalSlug: data?.canonicalSlug || data?.slug || '',
          canonicalSlugReviewed: Boolean(data?.canonicalSlugReviewed),
        });
        setSlugAliasesInput(Array.isArray(data?.slugAliases) ? data.slugAliases.join(', ') : '');
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchCategory();
  }, [categoryId, setFormValues, setError]);

  const navigateToCategories = () => {
    router.push('/categories');
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
        entityType: 'category',
        entityId: categoryId,
        locale: translationDecision.locale || 'en',
        expectedSourceRevision: translationDecision.sourceRevision,
        expectedTranslationRevision: translationDecision.translationRevision,
      });
      setTranslationDecision(null);
      navigateToCategories();
    } catch (decisionError) {
      setTranslationDecisionError(
        decisionError?.message || 'English translation decision was not saved.'
      );
    } finally {
      setTranslationDecisionLoading('');
    }
  };

  const handleEditSubmit = async (values, setSuccess, setError, setInvalidFields) => {
    try {
      const payload = {
        ...values,
        slugAliases: slugAliasesInput
          .split(',')
          .map((alias) => alias.trim())
          .filter(Boolean),
      };

      const res = await fetch(`${baseURL}/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await readResponseJsonSafely(res);

      if (!res.ok) {
        throw createResponseError(
          result?.message || 'Грешка при редакция на категория.',
          result
        );
      }

      setSuccess(true);
      setError('');
      setInvalidFields([]);
      triggerCategoriesReload();

      if (result?.englishTranslationDecision) {
        setTranslationDecisionError('');
        setTranslationDecision(result.englishTranslationDecision);
        return;
      }

      router.push('/categories');
    } catch (err) {
      setSuccess(false);
      setError(extractErrorMessage(err));
      if (err.field) {
        setInvalidFields([err.field]);
      } else {
        setInvalidFields([]);
      }
    }
  };

  const handleReviewedChange = (e) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      canonicalSlugReviewed: e.target.checked,
    }));
  };

  if (loading) return <p>Зареждане...</p>;

  return (
    <div className={styles.registerFormContainer}>
      <TranslationDecisionModal
        decision={translationDecision}
        entityLabel="category"
        busyAction={translationDecisionLoading}
        error={translationDecisionError}
        onYes={() => handleTranslationDecision('yes')}
        onNo={() => handleTranslationDecision('no')}
        onDismiss={() => {
          setTranslationDecision(null);
          navigateToCategories();
        }}
      />
      {error && <MessageBox type="error" message={`Грешка: ${error}`} />}
      {success && <MessageBox type="success" message="Категорията беше редактирана успешно!" />}

      <legend>Редактирай категория</legend>

      <form
        className={styles.registerForm}
        onSubmit={(e) =>
          handleSubmit(
            e,
            formValues,
            setFormValues,
            setSuccess,
            setError,
            setInvalidFields,
            handleEditSubmit,
            [
              (values) => {
                const name = sanitizeText(values.name);
                if (name.length < 2) {
                  return {
                    fields: ['name'],
                    message: 'Името трябва да съдържа поне 2 символа.',
                  };
                }
                return null;
              },
            ]
          )
        }
      >
        <label htmlFor="name">Име на категория</label>
        <input
          type="text"
          name="name"
          value={formValues.name}
          onChange={handleChange}
          className={invalidFields.includes('name') ? styles.invalidField : ''}
        />

        <label htmlFor="canonicalSlug">Стабилен URL slug</label>
        <input
          type="text"
          name="canonicalSlug"
          value={formValues.canonicalSlug}
          onChange={handleChange}
          className={invalidFields.includes('canonicalSlug') ? styles.invalidField : ''}
        />

        <label htmlFor="slugAliases">Предишни slug aliases</label>
        <input
          type="text"
          name="slugAliases"
          value={slugAliasesInput}
          onChange={(e) => setSlugAliasesInput(e.target.value)}
          className={invalidFields.includes('slugAliases') ? styles.invalidField : ''}
        />

        <label>
          <input
            type="checkbox"
            name="canonicalSlugReviewed"
            checked={formValues.canonicalSlugReviewed}
            onChange={handleReviewedChange}
          />
          Slug-ът е прегледан
        </label>

        <button type="submit">Запази</button>
      </form>
    </div>
  );
}
