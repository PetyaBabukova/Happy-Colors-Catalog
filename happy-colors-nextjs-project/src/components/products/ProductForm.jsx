'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useForm from '@/hooks/useForm';
import { handleSubmit } from '@/utils/formSubmitHelper';
import MessageBox from '@/components/ui/MessageBox';
import { useProducts } from '@/context/ProductContext';
import styles from './create.module.css';
import {
  deleteSignedUploadedFile,
  uploadImagesToBucket,
  uploadSignedFile,
} from '@/managers/uploadManager';
import { deleteProductImage, deleteProductVideo } from '@/managers/productsManager';
import {
  ALLOWED_IMAGE_UPLOAD_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_SIZE_BYTES,
  MAX_VIDEOS_PER_PRODUCT,
  RECOMMENDED_VIDEO_DURATION_SECONDS,
} from '@/config/productLimits';
import { getVideoDurationSeconds } from '@/utils/videoMetadata';

function normalizeVideos(videos) {
  return Array.isArray(videos)
    ? videos
        .filter((video) => video?.url && video?.posterUrl)
        .map((video) => ({
          url: video.url,
          posterUrl: video.posterUrl,
          mimeType: video.mimeType || '',
          durationSeconds: Number(video.durationSeconds) || 0,
          uploadDate: video.uploadDate || new Date().toISOString(),
          videoObjectName: video.videoObjectName || '',
          posterObjectName: video.posterObjectName || '',
          videoDeleteToken: video.videoDeleteToken || '',
          posterDeleteToken: video.posterDeleteToken || '',
        }))
    : [];
}

function formatMegabytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function getVideoValidationError(file) {
  if (!file) {
    return 'Моля, изберете MP4 видео файл.';
  }

  if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
    return 'Моля, качете видео във формат MP4.';
  }

  if (file.size > MAX_VIDEO_UPLOAD_SIZE_BYTES) {
    return `Видеото е твърде голямо. Максимален размер: ${formatMegabytes(MAX_VIDEO_UPLOAD_SIZE_BYTES)}.`;
  }

  return '';
}

function getPosterValidationError(file) {
  if (!file) {
    return 'Моля, изберете poster image за видеото.';
  }

  if (!ALLOWED_IMAGE_UPLOAD_MIME_TYPES.includes(file.type)) {
    return 'Poster image трябва да бъде JPG, PNG или WEBP файл.';
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return `Poster image е твърде голям. Максимален размер: ${formatMegabytes(MAX_IMAGE_UPLOAD_SIZE_BYTES)}.`;
  }

  return '';
}

function buildReplacementPatch(kind, uploadResult) {
  if (kind === 'video') {
    return {
      url: uploadResult.publicUrl,
      videoObjectName: uploadResult.objectName,
      videoDeleteToken: uploadResult.deleteToken,
    };
  }

  return {
    posterUrl: uploadResult.publicUrl,
    posterObjectName: uploadResult.objectName,
    posterDeleteToken: uploadResult.deleteToken,
  };
}

export default function ProductForm({ initialValues, onSubmit, legendText, successMessage }) {
  const router = useRouter();
  const { categories } = useProducts();
  const replaceInputRefs = useRef({});

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
    title: '',
    description: '',
    category: '',
    price: '',
    imageUrl: '',
    imageUrls: [],
    videos: [],
    availability: 'available',
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoDeletingUrl, setVideoDeletingUrl] = useState(null);
  const [videoUploadError, setVideoUploadError] = useState(null);
  const [videoDeleteError, setVideoDeleteError] = useState(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [selectedPosterFile, setSelectedPosterFile] = useState(null);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [videoReplacing, setVideoReplacing] = useState(null);

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    const normalizedImageUrls = Array.isArray(initialValues.imageUrls)
      ? initialValues.imageUrls.filter(Boolean)
      : initialValues.imageUrl
        ? [initialValues.imageUrl]
        : [];

    setFormValues({
      title: '',
      description: '',
      category: '',
      price: '',
      imageUrl: '',
      imageUrls: [],
      videos: [],
      availability: 'available',
      ...initialValues,
      imageUrls: normalizedImageUrls,
      imageUrl: normalizedImageUrls[0] || initialValues.imageUrl || '',
      category: initialValues.category?._id || initialValues.category || '',
      videos: normalizeVideos(initialValues.videos),
      availability: initialValues.availability || 'available',
    });
  }, [initialValues, setFormValues]);

  const savedVideoUrls = useMemo(
    () => new Set(normalizeVideos(initialValues?.videos).map((video) => video.url)),
    [initialValues?.videos]
  );
  const videos = normalizeVideos(formValues.videos);
  const hasImages = Array.isArray(formValues.imageUrls) && formValues.imageUrls.length > 0;
  const hasVideos = videos.length > 0;

  const setReplaceInputRef = (videoUrl, kind, node) => {
    const refKey = `${kind}:${videoUrl}`;

    if (node) {
      replaceInputRefs.current[refKey] = node;
      return;
    }

    delete replaceInputRefs.current[refKey];
  };

  const openReplaceInput = (videoUrl, kind) => {
    replaceInputRefs.current[`${kind}:${videoUrl}`]?.click();
  };

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) {
      return;
    }

    setUploadError(null);

    const hasInvalidType = selectedFiles.some((file) => !file.type.startsWith('image/'));
    if (hasInvalidType) {
      setUploadError('Моля, качете само файлове от тип изображение.');
      return;
    }

    const hasOversizedFile = selectedFiles.some((file) => file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES);
    if (hasOversizedFile) {
      setUploadError(
        `Един или повече файлове са твърде големи. Максимален размер: ${formatMegabytes(MAX_IMAGE_UPLOAD_SIZE_BYTES)}.`
      );
      return;
    }

    try {
      setUploading(true);

      const uploadedImageUrls = await uploadImagesToBucket(selectedFiles);

      setFormValues((prev) => {
        const currentImageUrls = Array.isArray(prev.imageUrls)
          ? prev.imageUrls.filter(Boolean)
          : prev.imageUrl
            ? [prev.imageUrl]
            : [];
        const mergedImageUrls = [...new Set([...currentImageUrls, ...uploadedImageUrls])];

        return {
          ...prev,
          imageUrls: mergedImageUrls,
          imageUrl: mergedImageUrls[0] || '',
        };
      });

      event.target.value = '';
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Възникна грешка при качването на изображенията.');
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async () => {
    setVideoUploadError(null);
    const uploadedUploads = [];
    let didAttachVideo = false;

    if (videos.length >= MAX_VIDEOS_PER_PRODUCT) {
      setVideoUploadError(`Можете да добавите най-много ${MAX_VIDEOS_PER_PRODUCT} видеа към продукт.`);
      return;
    }

    const videoValidationError = getVideoValidationError(selectedVideoFile);
    if (videoValidationError) {
      setVideoUploadError(videoValidationError);
      return;
    }

    const posterValidationError = getPosterValidationError(selectedPosterFile);
    if (posterValidationError) {
      setVideoUploadError(posterValidationError);
      return;
    }

    try {
      setVideoUploading(true);

      const durationSeconds = await getVideoDurationSeconds(selectedVideoFile);

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error('Не успяхме да прочетем продължителността на видеото.');
      }

      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error(`Видеото трябва да бъде до ${MAX_VIDEO_DURATION_SECONDS} секунди.`);
      }

      const posterUpload = await uploadSignedFile({ kind: 'poster', file: selectedPosterFile });
      uploadedUploads.push(posterUpload);

      const videoUpload = await uploadSignedFile({ kind: 'video', file: selectedVideoFile });
      uploadedUploads.push(videoUpload);

      setFormValues((prev) => ({
        ...prev,
        videos: [
          ...normalizeVideos(prev.videos),
          {
            url: videoUpload.publicUrl,
            posterUrl: posterUpload.publicUrl,
            mimeType: selectedVideoFile.type,
            durationSeconds,
            uploadDate: new Date().toISOString(),
            videoObjectName: videoUpload.objectName,
            posterObjectName: posterUpload.objectName,
            videoDeleteToken: videoUpload.deleteToken,
            posterDeleteToken: posterUpload.deleteToken,
          },
        ],
      }));
      didAttachVideo = true;

      setSelectedVideoFile(null);
      setSelectedPosterFile(null);
      setVideoInputKey((key) => key + 1);
    } catch (err) {
      console.error(err);

      if (!didAttachVideo) {
        await Promise.allSettled(
          uploadedUploads.map((upload) => deleteSignedUploadedFile(upload.objectName, upload.deleteToken))
        );
      }

      setVideoUploadError(err.message || 'Възникна грешка при качването на видеото.');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleReplaceVideoAsset = async (video, kind, file, event) => {
    if (event?.target) {
      event.target.value = '';
    }

    if (!file) {
      return;
    }

    setVideoUploadError(null);
    setVideoDeleteError(null);

    const validationError = kind === 'video'
      ? getVideoValidationError(file)
      : getPosterValidationError(file);

    if (validationError) {
      setVideoUploadError(validationError);
      return;
    }

    let uploadedUpload = null;
    let didAttachReplacement = false;

    try {
      setVideoReplacing({ videoUrl: video.url, kind });

      if (kind === 'video') {
        const durationSeconds = await getVideoDurationSeconds(file);

        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          throw new Error('Не успяхме да прочетем продължителността на видеото.');
        }

        if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
          throw new Error(`Видеото трябва да бъде до ${MAX_VIDEO_DURATION_SECONDS} секунди.`);
        }
      }

      uploadedUpload = await uploadSignedFile({ kind, file });

      setFormValues((prev) => ({
        ...prev,
        videos: normalizeVideos(prev.videos).map((item) =>
          item.url === video.url
            ? {
                ...item,
                ...buildReplacementPatch(kind, uploadedUpload),
              }
            : item
        ),
      }));
      didAttachReplacement = true;
    } catch (err) {
      console.error(err);

      if (!didAttachReplacement && uploadedUpload) {
        await Promise.allSettled([
          deleteSignedUploadedFile(uploadedUpload.objectName, uploadedUpload.deleteToken),
        ]);
      }

      setVideoUploadError(err.message || 'Възникна грешка при смяна на файла.');
    } finally {
      setVideoReplacing(null);
    }
  };

  const handleRemoveVideo = async (video) => {
    try {
      setVideoDeleteError(null);
      setVideoDeletingUrl(video.url);

      if (initialValues?._id && savedVideoUrls.has(video.url)) {
        const result = await deleteProductVideo(initialValues._id, video.url);

        setFormValues((prev) => {
          const serverVideos = normalizeVideos(result.videos);
          const localOnlyVideos = normalizeVideos(prev.videos).filter(
            (item) => !savedVideoUrls.has(item.url)
          );

          return {
            ...prev,
            videos: [...serverVideos, ...localOnlyVideos],
          };
        });
        return;
      }

      const cleanupResults = await Promise.allSettled([
        deleteSignedUploadedFile(video.videoObjectName, video.videoDeleteToken),
        deleteSignedUploadedFile(video.posterObjectName, video.posterDeleteToken),
      ]);

      const failedCleanup = cleanupResults.find((result) => result.status === 'rejected');

      if (failedCleanup) {
        throw failedCleanup.reason || new Error('Не успяхме да изчистим незаписания upload.');
      }

      setFormValues((prev) => ({
        ...prev,
        videos: normalizeVideos(prev.videos).filter((item) => item.url !== video.url),
      }));
    } catch (err) {
      setVideoDeleteError(err.message || 'Възникна грешка при премахването на видеото.');
    } finally {
      setVideoDeletingUrl(null);
    }
  };

  const validateVideoSubmitState = () => {
    if (videoDeletingUrl) {
      return {
        fields: ['videos'],
        message: 'Моля, изчакайте премахването на видеото да приключи.',
      };
    }

    if (videoUploading || videoReplacing) {
      return {
        fields: ['videos'],
        message: 'Моля, изчакайте качването на видеото да приключи.',
      };
    }

    if (selectedVideoFile || selectedPosterFile) {
      return {
        fields: ['videos'],
        message: 'Имате избрано видео или poster image. Натиснете "Качи видео" преди да запазите продукта.',
      };
    }

    return null;
  };

  return (
    <div className={styles.registerFormContainer}>
      {error && <MessageBox type="error" message={`Грешка: ${error}`} />}
      {success && <MessageBox type="success" message={successMessage || 'Успешно изпълнение'} />}

      <legend>{legendText}</legend>

      <form
        className={styles.registerForm}
        onSubmit={(event) =>
          handleSubmit(
            event,
            formValues,
            setFormValues,
            setSuccess,
            setError,
            setInvalidFields,
            (values, setSubmitSuccess, setSubmitError, setSubmitInvalidFields) =>
              onSubmit(values, setSubmitSuccess, setSubmitError, setSubmitInvalidFields, router),
            [validateVideoSubmitState]
          )
        }
      >
        <label htmlFor="title">Име на продукта</label>
        <input
          name="title"
          value={formValues.title}
          onChange={handleChange}
          className={invalidFields.includes('title') ? styles.invalidField : ''}
        />

        <label htmlFor="description">Описание</label>
        <input
          name="description"
          value={formValues.description}
          onChange={handleChange}
          className={invalidFields.includes('description') ? styles.invalidField : ''}
        />

        <label htmlFor="category">Категория</label>
        <select
          name="category"
          value={formValues.category}
          onChange={handleChange}
          className={invalidFields.includes('category') ? styles.invalidField : ''}
        >
          <option value="">-- Изберете категория --</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>

        <label htmlFor="price">Цена</label>
        <input
          type="number"
          name="price"
          value={formValues.price}
          onChange={handleChange}
          className={invalidFields.includes('price') ? styles.invalidField : ''}
        />

        <label htmlFor="availability">Наличност</label>
        <select
          name="availability"
          value={formValues.availability || 'available'}
          onChange={handleChange}
          className={invalidFields.includes('availability') ? styles.invalidField : ''}
        >
          <option value="available">Продуктът е наличен и може да го поръчате</option>
          <option value="unavailable">Продуктът не е наличен, ако желаете пратете запитване</option>
        </select>

        <label>Изображения</label>
        <input
          type="file"
          name="imageUrls"
          onChange={handleFileChange}
          accept="image/*"
          multiple
          className={
            invalidFields.includes('imageUrl') || invalidFields.includes('imageUrls')
              ? styles.invalidField
              : ''
          }
        />

        <p className={styles.fieldHint}>
          {hasImages
            ? 'Изберете още изображения, за да ги добавите към вече качените.'
            : 'Можете да качите едно или няколко изображения.'}
        </p>

        {uploading && <p className={styles.fieldHint}>Качване на изображенията...</p>}

        {(invalidFields.includes('imageUrl') || invalidFields.includes('imageUrls')) && (
          <p className={styles.fieldHint}>Моля изберете поне едно изображение.</p>
        )}

        {uploadError && <p className={styles.errorHint}>{uploadError}</p>}

        {hasImages && (
          <div className={styles.uploadedImagesPreview}>
            <p className={styles.fieldHint}>Текущи изображения: {formValues.imageUrls.length}</p>

            <ul>
              {formValues.imageUrls.map((url, index) => (
                <li key={`${url}-${index}`} className={styles.imagePreviewItem}>
                  <span>Изображение {index + 1}</span>

                  {formValues.imageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!initialValues?._id) {
                            return;
                          }

                          await deleteProductImage(initialValues._id, url);

                          setFormValues((prev) => {
                            const updated = prev.imageUrls.filter((img) => img !== url);

                            return {
                              ...prev,
                              imageUrls: updated,
                              imageUrl: updated[0] || '',
                            };
                          });
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      x
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className={styles.videoUploadSection}>
          <label>Кратки видеа</label>
          <p className={styles.fieldHint}>
            До {MAX_VIDEOS_PER_PRODUCT} MP4 видеа, всяко до {MAX_VIDEO_DURATION_SECONDS} секунди и{' '}
            {formatMegabytes(MAX_VIDEO_UPLOAD_SIZE_BYTES)}. Препоръчително: до{' '}
            {RECOMMENDED_VIDEO_DURATION_SECONDS} секунди. Poster image е задължителен.
          </p>

          <div className={styles.videoUploadGrid} key={videoInputKey}>
            <div>
              <label htmlFor="product-video-file">Видео файл</label>
              <input
                id="product-video-file"
                type="file"
                accept="video/mp4"
                onChange={(event) => setSelectedVideoFile(event.target.files?.[0] || null)}
                disabled={videos.length >= MAX_VIDEOS_PER_PRODUCT || videoUploading || Boolean(videoDeletingUrl)}
              />
            </div>

            <div>
              <label htmlFor="product-video-poster">Poster image</label>
              <input
                id="product-video-poster"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setSelectedPosterFile(event.target.files?.[0] || null)}
                disabled={videos.length >= MAX_VIDEOS_PER_PRODUCT || videoUploading || Boolean(videoDeletingUrl)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleVideoUpload}
            disabled={videoUploading || Boolean(videoDeletingUrl) || videos.length >= MAX_VIDEOS_PER_PRODUCT}
            className={styles.secondaryButton}
          >
            {videoUploading ? 'Качване на видео...' : 'Качи видео'}
          </button>

          {videoUploadError && <p className={styles.errorHint}>{videoUploadError}</p>}
          {videoDeleteError && <p className={styles.errorHint}>{videoDeleteError}</p>}

          {hasVideos && (
            <ul className={styles.videoPreviewList}>
              {videos.map((video, index) => {
                const isDeleting = videoDeletingUrl === video.url;
                const isReplacingVideo = videoReplacing?.videoUrl === video.url && videoReplacing.kind === 'video';
                const isReplacingPoster = videoReplacing?.videoUrl === video.url && videoReplacing.kind === 'poster';
                const isRowBusy = isDeleting || isReplacingVideo || isReplacingPoster;

                return (
                  <li key={video.url} className={styles.videoPreviewItem}>
                    <input
                      ref={(node) => setReplaceInputRef(video.url, 'video', node)}
                      type="file"
                      accept="video/mp4"
                      className={styles.hiddenFileInput}
                      onChange={(event) =>
                        handleReplaceVideoAsset(video, 'video', event.target.files?.[0] || null, event)
                      }
                    />
                    <input
                      ref={(node) => setReplaceInputRef(video.url, 'poster', node)}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className={styles.hiddenFileInput}
                      onChange={(event) =>
                        handleReplaceVideoAsset(video, 'poster', event.target.files?.[0] || null, event)
                      }
                    />

                    <Image
                      src={video.posterUrl}
                      alt={`Poster за видео ${index + 1}`}
                      width={144}
                      height={144}
                      className={styles.videoPreviewPoster}
                    />

                    <div className={styles.videoPreviewContent}>
                      <strong>Видео {index + 1}</strong>
                      <p>
                        {Math.round(video.durationSeconds)} сек. | {video.mimeType}
                      </p>
                      {(isReplacingVideo || isReplacingPoster) && (
                        <p className={styles.videoInlineStatus}>
                          {isReplacingVideo ? 'Сменяне на видео файл...' : 'Сменяне на poster...'}
                        </p>
                      )}
                    </div>

                    <div className={styles.videoPreviewActions}>
                      <button
                        type="button"
                        onClick={() => openReplaceInput(video.url, 'video')}
                        disabled={isRowBusy}
                        className={styles.secondaryButton}
                      >
                        Смени видео файл
                      </button>
                      <button
                        type="button"
                        onClick={() => openReplaceInput(video.url, 'poster')}
                        disabled={isRowBusy}
                        className={styles.secondaryButton}
                      >
                        Смени poster
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(video)}
                        disabled={isRowBusy}
                      >
                        {isDeleting ? 'Премахване...' : 'Премахни'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <button type="submit" disabled={videoUploading || Boolean(videoDeletingUrl) || Boolean(videoReplacing)}>
          Запази
        </button>
      </form>
    </div>
  );
}
