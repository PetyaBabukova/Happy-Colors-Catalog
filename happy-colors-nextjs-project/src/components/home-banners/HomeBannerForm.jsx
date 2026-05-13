'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MessageBox from '@/components/ui/MessageBox';
import useForm from '@/hooks/useForm';
import { deleteSignedUploadedFile, uploadSignedFile } from '@/managers/uploadManager';
import styles from './HomeBannerForm.module.css';

const INITIAL_VALUES = {
  title: '',
  description: '',
  ctaLabel: '',
  ctaHref: '',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};
const FIELD_LIMITS = {
  title: 120,
  description: 600,
  ctaLabel: 60,
  ctaHref: 300,
};

function getRequiredMissingFields(values) {
  return ['title', 'ctaLabel', 'ctaHref', 'imageUrl'].filter((field) => {
    const value = values[field];

    return typeof value !== 'string' || value.trim() === '';
  });
}

function validateCtaHref(ctaHref) {
  const href = String(ctaHref || '').trim();

  return href.startsWith('/') && !href.startsWith('//') && !href.includes('\\') && !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

function getTooLongFields(values) {
  return Object.entries(FIELD_LIMITS)
    .filter(([field, maxLength]) => String(values[field] || '').trim().length > maxLength)
    .map(([field]) => field);
}

function normalizeInitialValues(initialValues) {
  return {
    ...INITIAL_VALUES,
    ...initialValues,
    title: initialValues?.title || '',
    description: initialValues?.description || '',
    ctaLabel: initialValues?.ctaLabel || '',
    ctaHref: initialValues?.ctaHref || '',
    imageUrl: initialValues?.imageUrl || '',
    sortOrder: Number(initialValues?.sortOrder) || 0,
    isActive: typeof initialValues?.isActive === 'boolean' ? initialValues.isActive : true,
  };
}

export default function HomeBannerForm({
  initialValues = INITIAL_VALUES,
  onSubmit,
  legendText,
  successMessage = 'Банерът беше запазен успешно.',
}) {
  const router = useRouter();
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
  } = useForm(normalizeInitialValues(initialValues));
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);

  useEffect(() => {
    setFormValues(normalizeInitialValues(initialValues));
    setUploadedImage(null);
  }, [initialValues, setFormValues]);

  const cleanupUploadedImage = async (upload = uploadedImage) => {
    if (!upload?.objectName || !upload?.deleteToken) {
      return;
    }

    await deleteSignedUploadedFile(upload.objectName, upload.deleteToken);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    setUploadError('');

    if (!file.type.startsWith('image/')) {
      setUploadError('Моля, изберете файл с изображение.');
      event.target.value = '';
      return;
    }

    try {
      setUploading(true);

      if (uploadedImage) {
        await cleanupUploadedImage(uploadedImage);
      }

      const uploadResult = await uploadSignedFile({ kind: 'home-banner-image', file });

      setUploadedImage(uploadResult);
      setFormValues((prev) => ({
        ...prev,
        imageUrl: uploadResult.publicUrl,
      }));
      event.target.value = '';
    } catch (err) {
      setUploadError(err.message || 'Възникна грешка при качването на изображението.');
    } finally {
      setUploading(false);
    }
  };

  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;

    setFormValues((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (uploading || submitting) {
      return;
    }

    setError('');
    setSuccess(false);

    const missingFields = getRequiredMissingFields(formValues);

    if (missingFields.length > 0) {
      setInvalidFields(missingFields);
      setError('Моля, попълнете всички задължителни полета.');
      return;
    }

    const tooLongFields = getTooLongFields(formValues);

    if (tooLongFields.length > 0) {
      setInvalidFields(tooLongFields);
      setError('Краткият текст може да бъде до 600 символа, заглавието до 120, CTA текстът до 60, а CTA линкът до 300.');
      return;
    }

    if (!validateCtaHref(formValues.ctaHref)) {
      setInvalidFields(['ctaHref']);
      setError('CTA линкът трябва да бъде вътрешен път, например /search?q=животинки.');
      return;
    }

    const sortOrder = Number(formValues.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      setInvalidFields(['sortOrder']);
      setError('Подредбата трябва да бъде валидно число.');
      return;
    }

    try {
      setSubmitting(true);
      setInvalidFields([]);
      await onSubmit({
        ...formValues,
        title: formValues.title.trim(),
        description: formValues.description.trim(),
        ctaLabel: formValues.ctaLabel.trim(),
        ctaHref: formValues.ctaHref.trim(),
        imageUrl: formValues.imageUrl.trim(),
        sortOrder,
        isActive: Boolean(formValues.isActive),
      });
      setUploadedImage(null);
      setSuccess(true);
      router.push('/');
      router.refresh();
    } catch (err) {
      if (uploadedImage) {
        await cleanupUploadedImage(uploadedImage).catch(() => {});
        setUploadedImage(null);
        setFormValues((prev) => ({
          ...prev,
          imageUrl: initialValues?.imageUrl || '',
        }));
      }

      setSuccess(false);
      setError(err.message || 'Възникна грешка при запазването на банера.');

      if (err.field) {
        setInvalidFields([err.field]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      {error && <MessageBox type="error" message={`Грешка: ${error}`} />}
      {success && <MessageBox type="success" message={successMessage} />}

      <h2 className={styles.formTitle}>{legendText}</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="title">Заглавие</label>
        <input
          id="title"
          name="title"
          value={formValues.title}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.title}
          className={invalidFields.includes('title') ? styles.invalidField : ''}
        />

        <label htmlFor="description">Кратък текст</label>
        <textarea
          id="description"
          name="description"
          value={formValues.description}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.description}
          className={invalidFields.includes('description') ? styles.invalidField : ''}
        />

        <label htmlFor="ctaLabel">CTA текст</label>
        <input
          id="ctaLabel"
          name="ctaLabel"
          value={formValues.ctaLabel}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.ctaLabel}
          className={invalidFields.includes('ctaLabel') ? styles.invalidField : ''}
        />

        <label htmlFor="ctaHref">CTA линк</label>
        <input
          id="ctaHref"
          name="ctaHref"
          value={formValues.ctaHref}
          onChange={handleChange}
          placeholder="/search?q=животинки"
          maxLength={FIELD_LIMITS.ctaHref}
          className={invalidFields.includes('ctaHref') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Използвайте вътрешен линк, например /products или /search?q=животинки.</p>

        <label htmlFor="imageFile">Изображение</label>
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className={invalidFields.includes('imageUrl') ? styles.invalidField : ''}
        />
        {uploading && <p className={styles.fieldHint}>Качване на изображение...</p>}
        {uploadError && <p className={styles.errorHint}>{uploadError}</p>}

        {formValues.imageUrl && (
          <div className={styles.preview}>
            <span className={styles.fieldHint}>Текущо изображение</span>
            <img
              src={formValues.imageUrl}
              alt={formValues.title || 'Homepage banner preview'}
              className={styles.previewImage}
            />
          </div>
        )}

        <label htmlFor="sortOrder">Подредба</label>
        <input
          id="sortOrder"
          type="number"
          name="sortOrder"
          value={formValues.sortOrder}
          onChange={handleChange}
          className={invalidFields.includes('sortOrder') ? styles.invalidField : ''}
        />

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="isActive"
            checked={Boolean(formValues.isActive)}
            onChange={handleCheckboxChange}
          />
          Активен банер
        </label>

        <button type="submit" className={styles.submitButton} disabled={uploading || submitting}>
          Запази
        </button>
      </form>
    </div>
  );
}
