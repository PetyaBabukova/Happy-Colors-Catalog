import mongoose from 'mongoose';
import { PUBLIC_LOCALES } from './localizationSchemas.js';

const newsletterDeliverySchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewsletterCampaign',
      required: true,
      index: true,
    },
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewsletterSubscriber',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      maxlength: 254,
    },
    locale: {
      type: String,
      enum: PUBLIC_LOCALES,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'skipped'],
      default: 'pending',
      required: true,
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualAttemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    claimToken: {
      type: String,
      default: '',
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lastErrorReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    collection: 'newsletter_deliveries',
    timestamps: true,
  }
);

newsletterDeliverySchema.index({ campaignId: 1, subscriberId: 1 }, { unique: true, background: true });
newsletterDeliverySchema.index({ campaignId: 1, status: 1, createdAt: 1 }, { background: true });

export default mongoose.models.NewsletterDelivery ||
  mongoose.model('NewsletterDelivery', newsletterDeliverySchema);
