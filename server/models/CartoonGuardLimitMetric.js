import mongoose from 'mongoose';
import { CARTOON_GUARD_LIMIT_METRIC_TYPES } from '../helpers/cartoonUploadGuardConstants.js';

const cartoonGuardLimitMetricSchema = new mongoose.Schema(
  {
    metricType: {
      type: String,
      enum: CARTOON_GUARD_LIMIT_METRIC_TYPES,
      required: true,
    },
    windowStart: { type: Date, required: true },
    windowExpiresAt: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, required: true },
  },
  {
    collection: 'cartoon_guard_limit_metrics',
    timestamps: false,
  }
);

cartoonGuardLimitMetricSchema.index(
  { metricType: 1, windowStart: 1 },
  { unique: true, background: true }
);
cartoonGuardLimitMetricSchema.index(
  { windowExpiresAt: 1 },
  { expireAfterSeconds: 0, background: true }
);

export default mongoose.models.CartoonGuardLimitMetric ||
  mongoose.model('CartoonGuardLimitMetric', cartoonGuardLimitMetricSchema);
