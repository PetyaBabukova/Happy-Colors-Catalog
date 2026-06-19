export const CARTOON_GUARD_KEY_TYPES = Object.freeze(['browser', 'ip']);
export const CARTOON_GUARD_RESERVATION_TYPES = Object.freeze([
  'successful_inquiry',
  'upload_bytes',
]);
export const CARTOON_GUARD_RESERVATION_STATUSES = Object.freeze([
  'reserved',
  'confirmed',
  'released',
  'expired',
]);
export const CARTOON_ORDER_ABUSE_COUNTER_TYPES = Object.freeze([
  'successful_inquiry',
  'limit_hit',
]);
export const CARTOON_GUARD_LIMIT_METRIC_TYPES = Object.freeze([
  'successful_inquiry_limit_hit',
  'upload_byte_limit_hit',
]);
export const CARTOON_UPLOAD_CLEANUP_RUN_STATUSES = Object.freeze([
  'success',
  'partial_failure',
  'failed',
]);
export const CARTOON_UPLOAD_CLEANUP_RUN_TYPES = Object.freeze([
  'unclaimed_upload_cleanup',
  'claimed_orphan_reaper',
  'recordless_sweep',
  'byte_gauge_reconciliation',
]);
export const CARTOON_UPLOAD_CLEANUP_ERROR_CATEGORIES = Object.freeze([
  'none',
  'storage_delete_failed',
  'storage_absence_ambiguous',
  'storage_permission_denied',
  'session_update_failed',
  'invalid_photo_reference',
  'claimed_or_order_linked',
  'cleanup_lock_active',
  'quota_release_failed',
  'recordless_sweep_unavailable',
  'unknown_cleanup_error',
]);
export const CARTOON_UPLOAD_RECONCILIATION_STATUSES = Object.freeze([
  'not_run',
  'success',
  'partial_failure',
  'failed',
]);

const cleanupCategorySet = new Set(CARTOON_UPLOAD_CLEANUP_ERROR_CATEGORIES);

export function normalizeCartoonUploadCleanupCategory(value) {
  const category = String(value || '').trim();

  return cleanupCategorySet.has(category) ? category : 'unknown_cleanup_error';
}
