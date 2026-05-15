'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import MessageBox from '@/components/ui/MessageBox';
import { deleteSignedUploadedFile, uploadBlogArticleImage } from '@/managers/uploadManager';
import styles from './BlogArticleForm.module.css';

const RichTextEditor = dynamic(() => import('@/components/blog/RichTextEditor'), {
  ssr: false,
});

const FIELD_LIMITS = {
  title: 160,
  heroImageAlt: 180,
  seoTitle: 70,
  seoDescription: 170,
};
const EMPTY_EDITOR_HTML = '<p></p>';
const INITIAL_VALUES = {
  title: '',
  contentHtml: EMPTY_EDITOR_HTML,
  contentJson: null,
  contentText: '',
  heroImageUrl: '',
  thumbnailImageUrl: '',
  heroImageAlt: '',
  seoTitle: '',
  seoDescription: '',
  status: 'published',
};

function normalizeValues(initialValues = {}) {
  return {
    ...INITIAL_VALUES,
    ...initialValues,
    title: initialValues.title || '',
    contentHtml: initialValues.contentHtml || EMPTY_EDITOR_HTML,
    contentJson: initialValues.contentJson || null,
    contentText: initialValues.contentText || '',
    heroImageUrl: initialValues.heroImageUrl || '',
    thumbnailImageUrl: initialValues.thumbnailImageUrl || '',
    heroImageAlt: initialValues.heroImageAlt || '',
    seoTitle: initialValues.seoTitle || '',
    seoDescription: initialValues.seoDescription || '',
    status: initialValues.status || 'published',
  };
}

function isBlankHtml(values) {
  return !String(values.contentText || '').trim() && !String(values.contentHtml || '').replace(/<[^>]+>/g, '').trim();
}

function validate(values) {
  const invalidFields = [];

  if (!values.title.trim()) invalidFields.push('title');
  if (values.title.trim().length > FIELD_LIMITS.title) invalidFields.push('title');
  if (isBlankHtml(values)) invalidFields.push('contentHtml');
  if (!values.heroImageUrl) invalidFields.push('heroImageUrl');
  if (!values.thumbnailImageUrl) invalidFields.push('thumbnailImageUrl');
  if (!values.heroImageAlt.trim()) invalidFields.push('heroImageAlt');
  if (values.heroImageAlt.trim().length > FIELD_LIMITS.heroImageAlt) invalidFields.push('heroImageAlt');
  if (!['draft', 'published'].includes(values.status)) invalidFields.push('status');
  if (values.seoTitle.trim().length > FIELD_LIMITS.seoTitle) invalidFields.push('seoTitle');
  if (values.seoDescription.trim().length > FIELD_LIMITS.seoDescription) invalidFields.push('seoDescription');

  return [...new Set(invalidFields)];
}

async function cleanupBlogUpload(uploadedAssets) {
  const uploads = Object.values(uploadedAssets || {}).map((asset) => [
    asset?.objectName,
    asset?.deleteToken,
  ]);

  await Promise.all(
    uploads
      .filter(([objectName, deleteToken]) => objectName && deleteToken)
      .map(([objectName, deleteToken]) =>
        deleteSignedUploadedFile(objectName, deleteToken).catch((error) => {
          console.error('Неуспешно rollback изтриване на blog upload:', error);
        })
      )
  );
}

export default function BlogArticleForm({
  initialValues = INITIAL_VALUES,
  onSubmit,
  mode = 'create',
  submitLabel = 'Запази',
}) {
  const normalizedInitialValues = useMemo(() => normalizeValues(initialValues), [initialValues]);
  const [values, setValues] = useState(normalizedInitialValues);
  const [invalidFields, setInvalidFields] = useState([]);
  const [uploadedAssets, setUploadedAssets] = useState({});
  const uploadedAssetsRef = useRef({});
  const [uploadingKind, setUploadingKind] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const formHeading = mode === 'edit' ? 'Редактиране на блог статия' : 'Създаване на блог статия';
  const isUploading = Boolean(uploadingKind);

  const setTrackedUploadedAsset = (kind, nextAsset) => {
    const nextAssets = {
      ...uploadedAssetsRef.current,
      [kind]: nextAsset,
    };

    if (!nextAsset) {
      delete nextAssets[kind];
    }

    uploadedAssetsRef.current = nextAssets;
    setUploadedAssets(nextAssets);
  };

  useEffect(() => {
    if (Object.keys(uploadedAssetsRef.current).length > 0) {
      cleanupBlogUpload(uploadedAssetsRef.current);
    }

    uploadedAssetsRef.current = {};
    setValues(normalizedInitialValues);
    setUploadedAssets({});
  }, [normalizedInitialValues]);

  useEffect(
    () => () => {
      if (Object.keys(uploadedAssetsRef.current).length > 0) {
        cleanupBlogUpload(uploadedAssetsRef.current);
      }
    },
    []
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditorChange = (editorValues) => {
    setValues((prev) => ({
      ...prev,
      ...editorValues,
    }));
  };

  const handleImageChange = async (kind, event) => {
    const file = event.target.files?.[0] || null;

    if (!file) return;

    const fieldName = kind === 'thumbnail' ? 'thumbnailImageUrl' : 'heroImageUrl';

    setError('');

    if (!file.type.startsWith('image/')) {
      setInvalidFields([fieldName]);
      setError('Моля, изберете файл с изображение.');
      event.target.value = '';
      return;
    }

    try {
      setUploadingKind(kind);

      if (uploadedAssets[kind]) {
        await cleanupBlogUpload({ [kind]: uploadedAssets[kind] });
        setTrackedUploadedAsset(kind, null);
      }

      const uploadResult = await uploadBlogArticleImage({ kind, file });
      const valueField = kind === 'thumbnail' ? 'thumbnailImageUrl' : 'heroImageUrl';

      setTrackedUploadedAsset(kind, uploadResult);
      setValues((prev) => ({
        ...prev,
        [valueField]: uploadResult.imageUrl,
      }));
      event.target.value = '';
    } catch (err) {
      setError(err.message || 'Възникна грешка при качване на изображението.');
    } finally {
      setUploadingKind('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isUploading || submitting) return;

    const nextInvalidFields = validate(values);

    setInvalidFields(nextInvalidFields);
    setError('');

    if (nextInvalidFields.length > 0) {
      setError('Моля, проверете задължителните полета и ограниченията за дължина.');
      return;
    }

    const payload = {
      title: values.title.trim(),
      contentHtml: values.contentHtml,
      contentJson: values.contentJson,
      heroImageUrl: values.heroImageUrl,
      thumbnailImageUrl: values.thumbnailImageUrl,
      heroImageAlt: values.heroImageAlt.trim(),
      seoTitle: values.seoTitle.trim(),
      seoDescription: values.seoDescription.trim(),
      status: values.status,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      uploadedAssetsRef.current = {};
      setUploadedAssets({});
    } catch (err) {
      if (Object.keys(uploadedAssets).length > 0) {
        await cleanupBlogUpload(uploadedAssets);
        uploadedAssetsRef.current = {};
        setUploadedAssets({});
        setValues((prev) => ({
          ...prev,
          heroImageUrl: normalizedInitialValues.heroImageUrl,
          thumbnailImageUrl: normalizedInitialValues.thumbnailImageUrl,
        }));
      }

      setError(err.message || 'Възникна грешка при запазване на блог статията.');
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h1 className={styles.formTitle}>{formHeading}</h1>
      {error && <MessageBox type="error" message={`Грешка: ${error}`} />}
      {values.archivedAt && <MessageBox type="error" message="Тази статия е архивирана. Запазването няма да я публикува отново." />}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="title">Заглавие<span aria-hidden="true">*</span></label>
        <input
          id="title"
          name="title"
          value={values.title}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.title}
          className={invalidFields.includes('title') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля въведете заглавие на статията</p>

        <label htmlFor="heroImage">Основно изображение<span aria-hidden="true">*</span></label>
        <input
          id="heroImage"
          type="file"
          accept="image/*"
          onChange={(event) => handleImageChange('hero', event)}
          className={invalidFields.includes('heroImageUrl') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля изберете основно изображение на статията</p>
        {uploadingKind === 'hero' && <p className={styles.fieldHint}>Качване...</p>}

        {values.heroImageUrl && (
          <div className={styles.preview}>
            <img src={values.heroImageUrl} alt={values.heroImageAlt || values.title || 'Blog image preview'} />
          </div>
        )}

        <label htmlFor="thumbnailImage">Миниатюрно изображение<span aria-hidden="true">*</span></label>
        <input
          id="thumbnailImage"
          type="file"
          accept="image/*"
          onChange={(event) => handleImageChange('thumbnail', event)}
          className={invalidFields.includes('thumbnailImageUrl') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля изберете миниатюрно изображение на статията</p>
        {uploadingKind === 'thumbnail' && <p className={styles.fieldHint}>Качване...</p>}

        {values.thumbnailImageUrl && (
          <div className={`${styles.preview} ${styles.thumbnailPreview}`}>
            <img src={values.thumbnailImageUrl} alt={values.heroImageAlt || values.title || 'Blog thumbnail preview'} />
          </div>
        )}

        <label htmlFor="heroImageAlt">Alt Текст за изображението<span aria-hidden="true">*</span></label>
        <input
          id="heroImageAlt"
          name="heroImageAlt"
          value={values.heroImageAlt}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.heroImageAlt}
          className={invalidFields.includes('heroImageAlt') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля добавете Alt атрибут, касаещ изображението на статията</p>

        <label htmlFor="content">Съдържание<span aria-hidden="true">*</span></label>
        <RichTextEditor
          id="content"
          value={values.contentHtml}
          onChange={handleEditorChange}
          invalid={invalidFields.includes('contentHtml')}
        />
        <p className={styles.fieldHint}>Моля въведете съдържанието на статията</p>

        <label htmlFor="seoTitle">Meta Title</label>
        <input
          id="seoTitle"
          name="seoTitle"
          value={values.seoTitle}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.seoTitle}
          className={invalidFields.includes('seoTitle') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля въведете Meta Title на статията - до 70 символа</p>

        <label htmlFor="seoDescription">Meta Description</label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          value={values.seoDescription}
          onChange={handleChange}
          maxLength={FIELD_LIMITS.seoDescription}
          className={invalidFields.includes('seoDescription') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля въведете Meta Description на статията - до 170 символа</p>

        <div className={styles.actions}>
          <button type="submit" disabled={isUploading || submitting}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
