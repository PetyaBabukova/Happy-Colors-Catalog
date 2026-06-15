import { describe, expect, it } from 'vitest';
import { classifyStorageError } from '../../../helpers/storageErrorClassifier.js';

describe('storageErrorClassifier', () => {
  it('normalizes known storage errors to safe enum values', () => {
    expect(
      classifyStorageError(Object.assign(new Error('Forbidden'), { code: '403', name: 'ApiError' }))
    ).toEqual({
      errorCategory: 'permission_denied',
      code: 'permission_denied',
      name: 'provider_api_error',
    });

    expect(classifyStorageError(new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.'))).toEqual({
      errorCategory: 'bucket_not_configured',
      code: 'unknown',
      name: 'unknown',
    });
  });

  it('collapses provider-controlled unknown code and name values', () => {
    expect(
      classifyStorageError(
        Object.assign(new Error('bucket my-private-bucket object secret-path failed'), {
          code: 'RAW_BUCKET_happy-private-cartoon-orders',
          name: 'ProviderErrorWithPrincipalName',
        })
      )
    ).toEqual({
      errorCategory: 'unknown_storage_error',
      code: 'unknown',
      name: 'unknown',
    });
  });

  it('classifies not found as photo not found without treating it as proven cleanup', () => {
    expect(classifyStorageError(Object.assign(new Error('No such object'), { code: '404' }))).toEqual({
      errorCategory: 'photo_not_found',
      code: 'not_found',
      name: 'unknown',
    });
  });
});
