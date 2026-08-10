import { CARTOON_ORDER_PHOTO_PREFIX } from './config/productLimits.js';

export function createPublicUrl(bucketName, objectName) {
  return `https://storage.googleapis.com/${bucketName}/${objectName}`;
}

export function isCartoonOrderPhotoObjectName(objectName) {
  return (
    typeof objectName === 'string' &&
    objectName.startsWith(`${CARTOON_ORDER_PHOTO_PREFIX}/`) &&
    !objectName.split('/').some((part) => part === '..' || part === '.' || part.includes('\\'))
  );
}

export function extractObjectNameFromGcsUrl(assetUrl, { bucketName, warn = () => {}, logError = () => {} } = {}) {
  if (!assetUrl || !bucketName) {
    return null;
  }

  try {
    const rawAssetUrl = String(assetUrl);
    const decodedAssetUrl = decodeURIComponent(rawAssetUrl);

    if (
      /(^|\/)(\.{1,2})(\/|$)/.test(rawAssetUrl) ||
      /(^|\/)(\.{1,2})(\/|$)/.test(decodedAssetUrl)
    ) {
      return null;
    }

    const url = new URL(assetUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const decodedParts = parts.map((part) => decodeURIComponent(part));

    if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com') {
      return null;
    }

    if (
      decodedParts.some(
        (part) => part === '..' || part === '.' || part.includes('/') || part.includes('\\')
      )
    ) {
      return null;
    }

    if (parts.length < 2) {
      return null;
    }

    const bucketFromUrl = parts[0];

    if (bucketFromUrl !== bucketName) {
      warn(`GCS helper: bucket in URL (${bucketFromUrl}) != env bucket (${bucketName}).`);
      return null;
    }

    return parts.slice(1).join('/');
  } catch (error) {
    logError('GCS helper: invalid asset URL:', assetUrl, error);
    return null;
  }
}

function hasUnsafeScheme(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) && !value.toLowerCase().startsWith('https:');
}

function decodeOrOriginal(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function defaultMessages(label) {
  return {
    required: `${label} URL is required.`,
    safeStorage: `${label} URL must be a safe storage URL.`,
    validObject: `${label} URL must point to a valid storage object.`,
    invalid: `${label} URL is invalid.`,
    gcs: `${label} URL must be a Google Cloud Storage URL.`,
    credentials: `${label} URL must not include credentials.`,
    query: `${label} URL must not include query parameters.`,
    bucketConfigured: 'Storage bucket is not configured.',
    bucket: `${label} URL must point to the configured storage bucket.`,
    prefix: `${label} URL must point to the expected storage path.`,
  };
}

export function validateGcsPublicAssetUrl({
  assetUrl,
  bucketName,
  expectedPrefix = '',
  label = 'Image',
  messages = {},
  allowCredentials = false,
  allowSearchHash = false,
} = {}) {
  const copy = { ...defaultMessages(label), ...messages };
  const urlValue = String(assetUrl || '').trim();

  if (!urlValue) {
    return { ok: false, message: copy.required };
  }

  if (hasUnsafeScheme(urlValue)) {
    return { ok: false, message: copy.safeStorage };
  }

  const decodedUrlValue = decodeOrOriginal(urlValue);

  if (/(^|\/)(\.{1,2})(\/|$)/.test(urlValue) || /(^|\/)(\.{1,2})(\/|$)/.test(decodedUrlValue)) {
    return { ok: false, message: copy.validObject };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(urlValue);
  } catch {
    return { ok: false, message: copy.invalid };
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'storage.googleapis.com') {
    return { ok: false, message: copy.gcs };
  }

  if (!allowCredentials && (parsedUrl.username || parsedUrl.password)) {
    return { ok: false, message: copy.credentials };
  }

  if (!allowSearchHash && (parsedUrl.search || parsedUrl.hash)) {
    return { ok: false, message: copy.query };
  }

  if (!bucketName) {
    return { ok: false, message: copy.bucketConfigured, statusCode: 500 };
  }

  const parts = parsedUrl.pathname.split('/').filter(Boolean);

  if (parts.length < 2 || parts[0] !== bucketName) {
    return { ok: false, message: copy.bucket };
  }

  let decodedParts;

  try {
    decodedParts = parts.map((part) => decodeURIComponent(part));
  } catch {
    return { ok: false, message: copy.validObject };
  }

  if (
    decodedParts.some(
      (part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\')
    )
  ) {
    return { ok: false, message: copy.validObject };
  }

  const objectName = decodedParts.slice(1).join('/');

  if (expectedPrefix && !objectName.startsWith(expectedPrefix)) {
    return { ok: false, message: copy.prefix };
  }

  return { ok: true, value: urlValue, objectName };
}
