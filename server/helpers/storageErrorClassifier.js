const STORAGE_ERROR_CATEGORIES = new Set([
  'bucket_not_configured',
  'public_bucket_fallback_active',
  'credentials_not_resolved',
  'signer_not_available',
  'permission_denied',
  'bucket_not_found',
  'photo_not_found',
  'network_or_provider_error',
  'invalid_photo_reference',
  'unknown_storage_error',
]);

const CODE_ALIASES = new Map([
  ['400', 'invalid_request'],
  ['401', 'unauthenticated'],
  ['403', 'permission_denied'],
  ['404', 'not_found'],
  ['408', 'timeout'],
  ['429', 'rate_limited'],
  ['500', 'provider_internal'],
  ['502', 'provider_bad_gateway'],
  ['503', 'provider_unavailable'],
  ['504', 'timeout'],
  ['ENOENT', 'not_found'],
  ['EACCES', 'permission_denied'],
  ['EPERM', 'permission_denied'],
  ['ETIMEDOUT', 'timeout'],
  ['ECONNRESET', 'connection_reset'],
  ['ECONNREFUSED', 'connection_refused'],
  ['EAI_AGAIN', 'dns_retry'],
  ['ENOTFOUND', 'dns_not_found'],
]);

const SAFE_CODES = new Set([
  'invalid_request',
  'unauthenticated',
  'permission_denied',
  'not_found',
  'timeout',
  'rate_limited',
  'provider_internal',
  'provider_bad_gateway',
  'provider_unavailable',
  'connection_reset',
  'connection_refused',
  'dns_retry',
  'dns_not_found',
  'unknown',
]);

const NAME_ALIASES = new Map([
  ['ApiError', 'provider_api_error'],
  ['GaxiosError', 'provider_api_error'],
  ['FetchError', 'provider_network_error'],
  ['AbortError', 'provider_timeout_error'],
  ['TimeoutError', 'provider_timeout_error'],
  ['SigningError', 'provider_signing_error'],
]);

const SAFE_NAMES = new Set([
  'provider_api_error',
  'provider_network_error',
  'provider_timeout_error',
  'provider_signing_error',
  'unknown',
]);

function normalizeProviderCode(error) {
  const rawCode = String(error?.code || error?.statusCode || '').trim();
  const normalized = CODE_ALIASES.get(rawCode) || rawCode.toLowerCase();

  return SAFE_CODES.has(normalized) ? normalized : 'unknown';
}

function normalizeProviderName(error) {
  const rawName = String(error?.name || '').trim();
  const normalized = NAME_ALIASES.get(rawName) || rawName.toLowerCase();

  return SAFE_NAMES.has(normalized) ? normalized : 'unknown';
}

export function classifyStorageError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = normalizeProviderCode(error);
  const name = normalizeProviderName(error);
  let errorCategory = 'unknown_storage_error';

  if (
    message.includes('gcs_cartoon_orders_bucket_name') ||
    message.includes('cartoon orders bucket') ||
    message.includes('cartoon-orders bucket')
  ) {
    errorCategory = 'bucket_not_configured';
  } else if (
    message.includes('invalid cartoon order photo object name') ||
    message.includes('invalid cartoon order photo reference')
  ) {
    errorCategory = 'invalid_photo_reference';
  } else if (
    code === 'permission_denied' ||
    code === 'unauthenticated' ||
    message.includes('permission denied') ||
    message.includes('forbidden')
  ) {
    errorCategory = 'permission_denied';
  } else if (
    message.includes('sign') &&
    (message.includes('credential') || message.includes('private key') || message.includes('signer'))
  ) {
    errorCategory = 'signer_not_available';
  } else if (
    code === 'not_found' ||
    message.includes('no such object') ||
    message.includes('not found')
  ) {
    errorCategory = 'photo_not_found';
  } else if (
    [
      'timeout',
      'provider_internal',
      'provider_bad_gateway',
      'provider_unavailable',
      'connection_reset',
      'connection_refused',
      'dns_retry',
      'dns_not_found',
    ].includes(code)
  ) {
    errorCategory = 'network_or_provider_error';
  }

  if (!STORAGE_ERROR_CATEGORIES.has(errorCategory)) {
    errorCategory = 'unknown_storage_error';
  }

  return {
    errorCategory,
    code: errorCategory === 'unknown_storage_error' ? 'unknown' : code,
    name,
  };
}
