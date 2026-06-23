import mongoose from 'mongoose';
import {
  CARTOON_UPLOAD_CLEANUP_ERROR_CATEGORIES,
  CARTOON_UPLOAD_CLEANUP_RUN_STATUSES,
  CARTOON_UPLOAD_CLEANUP_RUN_TYPES,
  CARTOON_UPLOAD_RECONCILIATION_STATUSES,
} from '../helpers/cartoonUploadGuardConstants.js';

const cartoonUploadCleanupRunSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    runType: {
      type: String,
      enum: CARTOON_UPLOAD_CLEANUP_RUN_TYPES,
      default: 'unclaimed_upload_cleanup',
      required: true,
    },
    status: { type: String, enum: CARTOON_UPLOAD_CLEANUP_RUN_STATUSES, required: true },
    retentionHours: { type: Number, default: 24, min: 0 },
    scannedSessionCount: { type: Number, default: 0, min: 0 },
    candidateUploadCount: { type: Number, default: 0, min: 0 },
    deletedUploadCount: { type: Number, default: 0, min: 0 },
    failedUploadCount: { type: Number, default: 0, min: 0 },
    skippedLockedCount: { type: Number, default: 0, min: 0 },
    skippedOrderLinkedCount: { type: Number, default: 0, min: 0 },
    skippedUnsafeCount: { type: Number, default: 0, min: 0 },
    oldestDeletedAgeHours: { type: Number, default: null, min: 0 },
    errorCategory: {
      type: String,
      enum: CARTOON_UPLOAD_CLEANUP_ERROR_CATEGORIES,
      default: 'none',
    },
    reconciliationStatus: {
      type: String,
      enum: CARTOON_UPLOAD_RECONCILIATION_STATUSES,
      default: 'not_run',
    },
    reconciliationRepairedCounterCount: { type: Number, default: 0, min: 0 },
    reconciliationRepairedBytes: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: 'cartoon_upload_cleanup_runs',
    timestamps: false,
  }
);

cartoonUploadCleanupRunSchema.index({ runType: 1, startedAt: -1 }, { background: true });
cartoonUploadCleanupRunSchema.index({ startedAt: -1 }, { background: true });
cartoonUploadCleanupRunSchema.index(
  { expiresAt: 1 },
  { background: true, expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } }
);

export default mongoose.models.CartoonUploadCleanupRun ||
  mongoose.model('CartoonUploadCleanupRun', cartoonUploadCleanupRunSchema);
