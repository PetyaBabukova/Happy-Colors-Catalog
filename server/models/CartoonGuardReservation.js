import mongoose from 'mongoose';
import {
  CARTOON_GUARD_KEY_TYPES,
  CARTOON_GUARD_RESERVATION_STATUSES,
  CARTOON_GUARD_RESERVATION_TYPES,
} from '../helpers/cartoonUploadGuardConstants.js';

const cartoonGuardReservationSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true, trim: true },
    reservationType: {
      type: String,
      enum: CARTOON_GUARD_RESERVATION_TYPES,
      required: true,
    },
    reservationGroupId: { type: String, required: true, trim: true },
    keyHmac: { type: String, required: true, trim: true },
    keyType: { type: String, enum: CARTOON_GUARD_KEY_TYPES, required: true },
    counterWindowStart: { type: Date, default: null },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: CARTOON_GUARD_RESERVATION_STATUSES,
      default: 'reserved',
      required: true,
    },
    reservedAt: { type: Date, required: true },
    leaseExpiresAt: { type: Date, required: true },
    confirmedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: 'cartoon_guard_reservations',
    timestamps: false,
  }
);

cartoonGuardReservationSchema.index({ reservationId: 1 }, { unique: true, background: true });
cartoonGuardReservationSchema.index(
  { reservationType: 1, keyHmac: 1, keyType: 1, status: 1 },
  { background: true }
);
cartoonGuardReservationSchema.index(
  { leaseExpiresAt: 1, status: 1 },
  { background: true }
);
cartoonGuardReservationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    background: true,
    partialFilterExpression: { expiresAt: { $type: 'date' } },
  }
);

export default mongoose.models.CartoonGuardReservation ||
  mongoose.model('CartoonGuardReservation', cartoonGuardReservationSchema);
