'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useForm from '@/hooks/useForm';
import MessageBox from '@/components/ui/MessageBox';
import {
  validateEmptyFields,
  validateContactForm,
  validateContactLength,
  getContactMessageMaxLength,
} from '@/utils/formValidations';
import { sendContactForm } from '../../managers/contactsManager';
import {
  createCartoonOrder,
  createCartoonOrderUploadSession,
  cleanupCartoonOrderUploadedPhotos,
  uploadCartoonOrderPhoto,
} from '../../managers/cartoonOrdersManager';
import {
  ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES,
  MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
  MAX_CARTOON_ORDER_PHOTOS,
} from '@/config/productLimits';
import styles from '../../components/products/create.module.css';

const initialValues = {
  name: '',
  email: '',
  phone: '',
  message: '',
};

const cartoonPhotoMaxSizeMb = Math.floor(MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES / (1024 * 1024));
const PHOTO_STATUS_LABELS = {
  selected: 'Избрана',
  uploading: 'Качване...',
  uploaded: 'Качена',
  failed: 'Неуспешно',
  removed: 'Премахната',
  stale: 'Изтекла сесия',
};
const PHOTO_CLEANUP_ERROR_MESSAGE =
  '\u0421\u043d\u0438\u043c\u043a\u0430\u0442\u0430 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u043f\u0440\u0435\u043c\u0430\u0445\u043d\u0430\u0442\u0430. \u041c\u043e\u043b\u044f, \u043e\u043f\u0438\u0442\u0430\u0439\u0442\u0435 \u043e\u0442\u043d\u043e\u0432\u043e.';
const PHOTO_REMOVING_LABEL =
  '\u041f\u0440\u0435\u043c\u0430\u0445\u0432\u0430\u043d\u0435...';

function createPhotoItem(file, id) {
  return {
    id: `photo-${id}`,
    file,
    originalName: file.name || 'Снимка',
    contentType: file.type,
    size: file.size,
    status: 'selected',
    error: '',
    uploadedPhoto: null,
  };
}

function formatPhotoSize(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}

function getPhotoDisplayName(photo) {
  return photo?.originalName || photo?.file?.name || 'Снимка';
}

function isUploadSessionResetError(err) {
  const errorCode = err?.data?.code || '';

  return (
    err?.status === 401 ||
    errorCode === 'upload_session_expired' ||
    errorCode === 'upload_session_full'
  );
}

function hasPartialCleanupProgress(err) {
  return Number(err?.data?.deletedCount) > 0 && Number(err?.data?.failedCount) > 0;
}

export default function ContactForm({ product, productId = null, serviceContext = '' }) {
  const resolvedProductId = product?._id || productId;
  const isCartoonInquiry = serviceContext === 'cartoons';
  const messageMaxLength = getContactMessageMaxLength(serviceContext);
  const messageHint = isCartoonInquiry
    ? `Опишете какъв шарж си представяте: колко човека да има, повод, стил, важни детайли, професия, хоби, текст или конкретна идея. Съобщението ви не трябва да превишава ${messageMaxLength} символа.`
    : `Съобщението ви не трябва да превишава ${messageMaxLength} символа`;

  const {
    formValues,
    error,
    setError,
    success,
    setSuccess,
    invalidFields,
    setInvalidFields,
    handleChange,
    resetForm,
  } = useForm(initialValues);

  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState(null);
  const [cartoonPhotoItems, setCartoonPhotoItems] = useState([]);
  const [cartoonPhotoSlotsUsed, setCartoonPhotoSlotsUsed] = useState(0);
  const [photoError, setPhotoError] = useState('');
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isCleaningPhotos, setIsCleaningPhotos] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadSessionTokenRef = useRef('');
  const photoItemIdRef = useRef(0);

  const router = useRouter();
  const uploadedCartoonPhotos = cartoonPhotoItems
    .filter((photo) => photo.status === 'uploaded' && photo.uploadedPhoto)
    .map((photo) => photo.uploadedPhoto);
  const canResetCartoonPhotos = cartoonPhotoItems.length > 0;
  const hasCartoonRequiredFields =
    !isCartoonInquiry ||
    (
      formValues.name.trim() &&
      formValues.email.trim() &&
      formValues.message.trim() &&
      uploadedCartoonPhotos.length > 0 &&
      consentAccepted
    );
  const isSubmitDisabled =
    isSubmitting || isUploadingPhotos || isCleaningPhotos || !hasCartoonRequiredFields;
  const showCartoonSuccessPopup =
    isCartoonInquiry && notificationMessage && notificationType === 'success';

  useEffect(() => {
    if (notificationMessage && notificationType === 'success') {
      const timer = setTimeout(() => {
        setNotificationMessage('');
        setNotificationType(null);
        router.push(isCartoonInquiry ? '/cartoons' : '/products');
      }, 3000);

      return () => clearTimeout(timer);
    }

    if (notificationMessage && notificationType === 'error') {
      const timer = setTimeout(() => {
        setNotificationMessage('');
        setNotificationType(null);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isCartoonInquiry, notificationMessage, notificationType, router]);

  const ensureCartoonUploadSession = async () => {
    if (uploadSessionTokenRef.current) {
      return uploadSessionTokenRef.current;
    }

    const uploadSession = await createCartoonOrderUploadSession();
    uploadSessionTokenRef.current = uploadSession.uploadSessionToken;

    return uploadSession.uploadSessionToken;
  };

  const clearCartoonUploadSession = () => {
    uploadSessionTokenRef.current = '';
  };

  const validateCartoonPhotoFiles = (files) => {
    if (cartoonPhotoSlotsUsed + files.length > MAX_CARTOON_ORDER_PHOTOS) {
      return `Можете да качите до ${MAX_CARTOON_ORDER_PHOTOS} снимки.`;
    }

    const unsupportedFile = files.find((file) => (
      !ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES.includes(file.type)
    ));

    if (unsupportedFile) {
      return 'Моля качете снимки във формат JPG, PNG или WEBP.';
    }

    const oversizedFile = files.find((file) => file.size > MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES);

    if (oversizedFile) {
      return `Всяка снимка трябва да е до ${cartoonPhotoMaxSizeMb} MB.`;
    }

    const emptyFile = files.find((file) => file.size <= 0);

    if (emptyFile) {
      return 'Моля качете валиден файл със снимка.';
    }

    return '';
  };

  const markCartoonPhotosStale = (message) => {
    clearCartoonUploadSession();
    setCartoonPhotoSlotsUsed(0);
    setCartoonPhotoItems((currentPhotos) => (
      currentPhotos.map((photo) => ({
        ...photo,
        status: 'stale',
        error: '',
        uploadedPhoto: null,
      }))
    ));
    setPhotoError(message);
  };

  const updateCartoonPhotoItem = (photoId, update) => {
    setCartoonPhotoItems((currentPhotos) => (
      currentPhotos.map((photo) => (
        photo.id === photoId
          ? {
              ...photo,
              ...(typeof update === 'function' ? update(photo) : update),
            }
          : photo
      ))
    ));
  };

  const uploadCartoonPhotoItem = async (photoItem) => {
    updateCartoonPhotoItem(photoItem.id, { status: 'uploading', error: '' });

    try {
      const uploadSessionToken = await ensureCartoonUploadSession();
      const uploadedPhoto = await uploadCartoonOrderPhoto({
        file: photoItem.file,
        uploadSessionToken,
      });
      const normalizedPhoto = {
        objectName: uploadedPhoto.objectName,
        uploadConfirmationToken: uploadedPhoto.uploadConfirmationToken,
        originalName: uploadedPhoto.originalName || photoItem.originalName || 'Снимка',
        contentType: uploadedPhoto.contentType,
        size: uploadedPhoto.size,
      };

      updateCartoonPhotoItem(photoItem.id, {
        status: 'uploaded',
        error: '',
        originalName: normalizedPhoto.originalName,
        contentType: normalizedPhoto.contentType,
        size: normalizedPhoto.size,
        uploadedPhoto: normalizedPhoto,
      });
      setCartoonPhotoSlotsUsed((currentCount) => currentCount + 1);
      return true;
    } catch (err) {
      const message = err?.message || 'Качването на снимката не беше успешно.';

      if (isUploadSessionResetError(err)) {
        markCartoonPhotosStale('Сесията за качване трябва да се поднови. Моля изберете снимките отново.');
        return false;
      }

      const errorCode = err?.data?.code || '';
      updateCartoonPhotoItem(photoItem.id, {
        status: 'failed',
        error: errorCode === 'upload_session_duplicate'
          ? 'Тази снимка вече е качена към текущата заявка.'
          : message,
      });
      return true;
    }
  };

  const handleCartoonPhotoSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!isCartoonInquiry || files.length === 0) {
      return;
    }

    const validationError = validateCartoonPhotoFiles(files);

    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    setPhotoError('');
    const photoItems = files.map((file) => {
      const photoItem = createPhotoItem(file, photoItemIdRef.current);
      photoItemIdRef.current += 1;
      return photoItem;
    });
    setCartoonPhotoItems((currentPhotos) => [
      ...currentPhotos,
      ...photoItems,
    ]);
    setIsUploadingPhotos(true);

    try {
      for (const photoItem of photoItems) {
        const shouldContinue = await uploadCartoonPhotoItem(photoItem);

        if (!shouldContinue) {
          break;
        }
      }
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const retryCartoonPhoto = async (photoId) => {
    const photoItem = cartoonPhotoItems.find((photo) => photo.id === photoId);

    if (!photoItem?.file || photoItem.status !== 'failed') {
      return;
    }

    if (cartoonPhotoSlotsUsed >= MAX_CARTOON_ORDER_PHOTOS) {
      updateCartoonPhotoItem(photoId, {
        error: 'Няма свободни места в текущата сесия. Изберете снимките отново.',
      });
      return;
    }

    setPhotoError('');
    setIsUploadingPhotos(true);

    try {
      await uploadCartoonPhotoItem(photoItem);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const cleanupUploadedCartoonPhotos = async (uploadedPhotos) => {
    const uploadConfirmationTokens = uploadedPhotos
      .map((photo) => photo?.uploadConfirmationToken)
      .filter(Boolean);

    if (uploadConfirmationTokens.length === 0) {
      return;
    }

    const result = await cleanupCartoonOrderUploadedPhotos({
      uploadSessionToken: uploadSessionTokenRef.current,
      uploadConfirmationTokens,
    });

    if (Number(result?.failedCount) > 0) {
      const error = new Error(PHOTO_CLEANUP_ERROR_MESSAGE);

      error.data = result;
      throw error;
    }
  };

  const removeCartoonPhoto = async (photoId) => {
    const photoItem = cartoonPhotoItems.find((photo) => photo.id === photoId);

    if (!photoItem || photoItem.status === 'uploading' || photoItem.status === 'removing') {
      return;
    }

    setPhotoError('');

    if (!photoItem.uploadedPhoto) {
      setCartoonPhotoItems((currentPhotos) => (
        currentPhotos.filter((photo) => photo.id !== photoId)
      ));
      return;
    }

    updateCartoonPhotoItem(photoId, { status: 'removing', error: '' });
    setIsCleaningPhotos(true);

    try {
      await cleanupUploadedCartoonPhotos([photoItem.uploadedPhoto]);
      setCartoonPhotoItems((currentPhotos) => (
        currentPhotos.filter((photo) => photo.id !== photoId)
      ));
      setCartoonPhotoSlotsUsed((currentCount) => Math.max(currentCount - 1, 0));
    } catch {
      updateCartoonPhotoItem(photoId, {
        status: 'uploaded',
        error: PHOTO_CLEANUP_ERROR_MESSAGE,
      });
      setPhotoError(PHOTO_CLEANUP_ERROR_MESSAGE);
    } finally {
      setIsCleaningPhotos(false);
    }
  };

  const clearCartoonOrderLocalState = () => {
    clearCartoonUploadSession();
    setCartoonPhotoItems([]);
    setCartoonPhotoSlotsUsed(0);
    setPhotoError('');
    setConsentAccepted(false);
    setWebsite('');
  };

  const cleanupAndResetCartoonOrderState = async () => {
    if (isCleaningPhotos || isUploadingPhotos || isSubmitting) {
      return;
    }

    const uploadedPhotos = cartoonPhotoItems
      .filter((photo) => photo.status === 'uploaded' && photo.uploadedPhoto)
      .map((photo) => photo.uploadedPhoto);

    if (uploadedPhotos.length === 0) {
      clearCartoonOrderLocalState();
      return;
    }

    setPhotoError('');
    setIsCleaningPhotos(true);

    try {
      await cleanupUploadedCartoonPhotos(uploadedPhotos);
      clearCartoonOrderLocalState();
    } catch (err) {
      if (hasPartialCleanupProgress(err)) {
        clearCartoonOrderLocalState();
      }

      setPhotoError(PHOTO_CLEANUP_ERROR_MESSAGE);
    } finally {
      setIsCleaningPhotos(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting || isUploadingPhotos || isCleaningPhotos) {
      return;
    }

    setNotificationMessage('');
    setNotificationType(null);

    const emptyFields = validateEmptyFields(formValues);
    if (emptyFields.length > 0) {
      setInvalidFields(emptyFields);
      setError('Моля попълнете всички задължителни полета');
      return;
    }

    const lengthErrors = validateContactLength(formValues, { messageMaxLength });
    if (lengthErrors.length > 0) {
      setInvalidFields(lengthErrors);
      setError('Моля проверете дължината и формата на въведените данни');
      return;
    }

    const { sanitizedValues, hasForbiddenChars } = validateContactForm(formValues);

    if (hasForbiddenChars) {
      setError('Използване на забранени символи!');
      return;
    }

    if (isCartoonInquiry) {
      // productId е опционален — общите запитвания са само свободен текст + снимки.
      if (uploadedCartoonPhotos.length === 0) {
        setPhotoError('Моля качете поне една референтна снимка.');
        return;
      }

      if (!consentAccepted) {
        setError('Моля потвърдете съгласието за използване на качените снимки.');
        return;
      }
    }

    const payload = isCartoonInquiry
      ? {
          ...sanitizedValues,
          productId: resolvedProductId || null,
          photos: uploadedCartoonPhotos,
          consentAccepted,
          website,
        }
      : {
          ...sanitizedValues,
          productId: resolvedProductId || null,
          productTitle: product?.title || null,
          productUrl: resolvedProductId ? `${window.location.origin}/products/${resolvedProductId}` : null,
        };

    try {
      setIsSubmitting(true);

      if (isCartoonInquiry) {
        await createCartoonOrder(payload);
      } else {
        await sendContactForm(payload);
      }

      setSuccess(true);
      setNotificationMessage(
        isCartoonInquiry
          ? 'Благодарим! Получихме запитването ви за шарж и ще се свържем с вас при първа възможност.'
          : product?.title
          ? `Получихме запитването ви за продукт ${product.title}. Ще се свържем с вас при първа възможност.`
          : 'Благодарим! Ще се свържем с вас при първа възможност.'
      );
      setNotificationType('success');
      resetForm();
      if (isCartoonInquiry) {
        clearCartoonOrderLocalState();
      }
    } catch (err) {
      if (isCartoonInquiry && err?.status === 409) {
        markCartoonPhotosStale('Снимките вече не могат да бъдат използвани. Моля качете ги отново и изпратете заявката пак.');
        setNotificationMessage('Снимките вече не могат да бъдат използвани. Моля качете ги отново и изпратете заявката пак.');
      } else if (err?.status === 409) {
        setNotificationMessage(err?.message || 'Заявката не може да бъде обработена. Моля опитайте отново.');
      } else {
        setNotificationMessage('Проблеми със свързването, моля опитайте по-късно.');
      }
      setNotificationType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.registerFormContainer}>
      {showCartoonSuccessPopup ? (
        <div className={styles.successPopupBackdrop}>
          <div className={styles.successPopup} role="status" aria-live="polite">
            {notificationMessage}
          </div>
        </div>
      ) : null}

      {!showCartoonSuccessPopup && notificationMessage ? (
        <MessageBox type={notificationType} message={notificationMessage} />
      ) : error ? (
        <MessageBox type="error" message={error} />
      ) : success ? (
        <MessageBox type="success" message="Съобщението беше изпратено успешно!" />
      ) : null}

      <form className={styles.registerForm} onSubmit={handleSubmit}>
        <h3>{isCartoonInquiry ? 'Запитване за шарж' : 'Свържете се с нас'}</h3>
        {isCartoonInquiry && (
          <p className={styles.cartoonInquirySubtitle}>
            Изпратете запитване. Ще се свържем с вас за уточнение на цена, срок, вариант и начин на изработка.
          </p>
        )}
        {!isCartoonInquiry && product?.title && (
          <p><b>Изпращате запитване за: {product.title}</b></p>
        )}
        <label htmlFor="name">
          Име<span className={styles.red}>*</span>
        </label>
        <input
          id="name"
          name="name"
          value={formValues.name}
          onChange={handleChange}
          className={invalidFields.includes('name') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Името трябва да е с дължина от 3 до 20 символа</p>

        <label htmlFor="email">
          Имейл<span className={styles.red}>*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formValues.email}
          onChange={handleChange}
          className={invalidFields.includes('email') ? styles.invalidField : ''}
        />
        <p className={styles.fieldHint}>Моля въведете валиден email адрес</p>

        <label htmlFor="phone">Телефон</label>
        <input
          id="phone"
          name="phone"
          type="text"
          value={formValues.phone}
          onChange={handleChange}
          className={invalidFields.includes('phone') ? styles.invalidField : ''}
        />

        <label htmlFor="message">
          Съобщение<span className={styles.red}>*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows="6"
          value={formValues.message}
          onChange={handleChange}
          maxLength={messageMaxLength}
          className={invalidFields.includes('message') ? styles.invalidField : ''}
          style={{
            padding: '0.5rem',
            border: '1px solid var(--dark-green)',
            borderRadius: '5px',
            fontSize: '1rem',
            marginBottom: '0.5em',
            fontFamily: 'inherit',
          }}
        />
        <p className={styles.fieldHint}>{messageHint}</p>

        {isCartoonInquiry && (
          <>
            <div className={styles.videoUploadSection} data-testid="cartoon-photo-upload">
              <label htmlFor="cartoonPhotos">
                Референтни снимки<span className={styles.red}>*</span>
              </label>
              <input
                id="cartoonPhotos"
                name="cartoonPhotos"
                type="file"
                accept={ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES.join(',')}
                multiple
                onChange={handleCartoonPhotoSelection}
                disabled={isUploadingPhotos || isCleaningPhotos || cartoonPhotoSlotsUsed >= MAX_CARTOON_ORDER_PHOTOS}
              />
              <p className={styles.fieldHint}>
                До {MAX_CARTOON_ORDER_PHOTOS} снимки, всяка до {cartoonPhotoMaxSizeMb} MB. Поддържани формати: JPG, PNG, WEBP.
              </p>
              {photoError && (
                <p className={styles.errorHint} role="alert">{photoError}</p>
              )}
              {isUploadingPhotos && (
                <p className={styles.videoInlineStatus}>Качване...</p>
              )}
              {isCleaningPhotos && (
                <p className={styles.videoInlineStatus}>{PHOTO_REMOVING_LABEL}</p>
              )}
              {cartoonPhotoItems.length > 0 && (
                <ul className={styles.videoPreviewList} data-testid="cartoon-photo-list">
                  {cartoonPhotoItems.map((photo) => (
                    <li
                      key={photo.id}
                      className={`${styles.videoPreviewItem} ${styles.photoPreviewItem}`}
                      data-photo-status={photo.status}
                    >
                      <div className={styles.videoPreviewContent}>
                        <strong>{getPhotoDisplayName(photo)}</strong>
                        <p>
                          {photo.contentType || 'image'} · {formatPhotoSize(photo.size)} · {PHOTO_STATUS_LABELS[photo.status] || PHOTO_REMOVING_LABEL}
                        </p>
                        {photo.error && (
                          <p className={styles.errorHint}>{photo.error}</p>
                        )}
                      </div>
                      <div className={styles.videoPreviewActions}>
                        {photo.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => retryCartoonPhoto(photo.id)}
                            disabled={isSubmitting || isUploadingPhotos || isCleaningPhotos}
                          >
                            Опитай пак
                          </button>
                        )}
                        {photo.status !== 'removed' && photo.status !== 'stale' && (
                          <button
                            type="button"
                            onClick={() => removeCartoonPhoto(photo.id)}
                            disabled={isSubmitting || isCleaningPhotos || photo.status === 'uploading' || photo.status === 'removing'}
                          >
                            Премахни
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canResetCartoonPhotos && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={cleanupAndResetCartoonOrderState}
                  disabled={isSubmitting || isUploadingPhotos || isCleaningPhotos}
                >
                  Избери снимките отново
                </button>
              )}
            </div>

            <label className={styles.checkboxLabel} htmlFor="cartoonConsent">
              <input
                id="cartoonConsent"
                name="cartoonConsent"
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
              />
              Съгласявам се качените снимки да бъдат използвани единствено за разглеждане на запитването и изготвяне на индивидуална оферта за шарж.
            </label>

            <input
              type="text"
              name="website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className={styles.honeypotField}
              tabIndex="-1"
              autoComplete="off"
              aria-hidden="true"
            />
          </>
        )}

        <button type="submit" disabled={isSubmitDisabled}>Изпрати</button>
      </form>
    </div>
  );
}
