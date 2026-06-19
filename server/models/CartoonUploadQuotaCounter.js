import mongoose from 'mongoose';
import { CARTOON_GUARD_KEY_TYPES } from '../helpers/cartoonUploadGuardConstants.js';

const cartoonUploadQuotaCounterSchema = new mongoose.Schema(
  {
    keyHmac: { type: String, required: true, trim: true },
    keyType: { type: String, enum: CARTOON_GUARD_KEY_TYPES, required: true },
    confirmedOutstandingBytes: { type: Number, default: 0, min: 0 },
    reservedBytes: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, required: true },
    zeroedAt: { type: Date, default: null },
  },
  {
    collection: 'cartoon_upload_quota_counters',
    timestamps: false,
  }
);

cartoonUploadQuotaCounterSchema.index({ keyHmac: 1, keyType: 1 }, { unique: true, background: true });
cartoonUploadQuotaCounterSchema.index(
  { zeroedAt: 1 },
  {
    expireAfterSeconds: 0,
    background: true,
    partialFilterExpression: {
      confirmedOutstandingBytes: 0,
      reservedBytes: 0,
      zeroedAt: { $type: 'date' },
    },
  }
);

export default mongoose.models.CartoonUploadQuotaCounter ||
  mongoose.model('CartoonUploadQuotaCounter', cartoonUploadQuotaCounterSchema);
