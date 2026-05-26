export const PRODUCT_PUBLICATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
});

export const PRODUCT_PUBLICATION_STATUS_VALUES = Object.freeze(
  Object.values(PRODUCT_PUBLICATION_STATUSES)
);

export const PRODUCT_REVIEW_STATUSES = Object.freeze({
  NONE: 'none',
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
});

export const PRODUCT_REVIEW_STATUS_VALUES = Object.freeze(
  Object.values(PRODUCT_REVIEW_STATUSES)
);

export const PRODUCT_REVIEW_NOTE_MAX_LENGTH = 1000;

export function normalizePublicationStatus(status) {
  return PRODUCT_PUBLICATION_STATUS_VALUES.includes(status)
    ? status
    : PRODUCT_PUBLICATION_STATUSES.DRAFT;
}

export function buildPublicProductFilter({ includeLegacyMissingStatus = true } = {}) {
  if (!includeLegacyMissingStatus) {
    return { publicationStatus: PRODUCT_PUBLICATION_STATUSES.PUBLISHED };
  }

  return {
    $or: [
      { publicationStatus: PRODUCT_PUBLICATION_STATUSES.PUBLISHED },
      { publicationStatus: { $exists: false } },
    ],
  };
}

export function isPublicProduct(product) {
  return (
    product?.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED ||
    typeof product?.publicationStatus === 'undefined'
  );
}

export function normalizeReviewNote(reviewNote, { required = false } = {}) {
  const normalized = String(reviewNote || '').trim();

  if (required && !normalized) {
    const error = new Error('Review note is required.');
    error.statusCode = 400;
    throw error;
  }

  if (normalized.length > PRODUCT_REVIEW_NOTE_MAX_LENGTH) {
    const error = new Error(
      `Review note must be at most ${PRODUCT_REVIEW_NOTE_MAX_LENGTH} characters.`
    );
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}
