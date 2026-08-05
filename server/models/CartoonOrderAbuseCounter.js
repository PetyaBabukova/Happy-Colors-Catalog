import mongoose from 'mongoose';
import {
  CARTOON_GUARD_KEY_TYPES,
  CARTOON_ORDER_ABUSE_COUNTER_TYPES,
} from '../helpers/cartoonUploadGuardConstants.js';

const cartoonOrderAbuseCounterSchema = new mongoose.Schema(
  {
    keyHmac: { type: String, required: true, trim: true },
    keyType: { type: String, enum: CARTOON_GUARD_KEY_TYPES, required: true },
    counterType: {
      type: String,
      enum: CARTOON_ORDER_ABUSE_COUNTER_TYPES,
      required: true,
    },
    windowStart: { type: Date, required: true },
    windowExpiresAt: { type: Date, required: true },
    confirmedCount: { type: Number, default: 0, min: 0 },
    reservedCount: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    collection: 'cartoon_order_abuse_counters',
    timestamps: false,
  }
);

cartoonOrderAbuseCounterSchema.index(
  { keyHmac: 1, keyType: 1, counterType: 1, windowStart: 1 },
  { unique: true, background: true }
);
cartoonOrderAbuseCounterSchema.index(
  { windowExpiresAt: 1 },
  { expireAfterSeconds: 0, background: true }
);

export default mongoose.models.CartoonOrderAbuseCounter ||
  mongoose.model('CartoonOrderAbuseCounter', cartoonOrderAbuseCounterSchema);
