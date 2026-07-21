import mongoose from 'mongoose';
import { PUBLIC_LOCALES } from './localizationSchemas.js';

const newsletterCampaignSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['sending', 'completed'],
      default: 'sending',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['custom', 'product', 'blog'],
      required: true,
    },
    sourceId: {
      type: String,
      default: '',
    },
    selectedLocales: {
      type: [String],
      enum: PUBLIC_LOCALES,
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one newsletter campaign locale is required.',
      },
    },
    subject: {
      type: String,
      required: true,
      maxlength: 160,
    },
    title: {
      type: String,
      required: true,
      maxlength: 160,
    },
    contentHtml: {
      type: String,
      required: true,
    },
    contentText: {
      type: String,
      required: true,
    },
    contentJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ctaPath: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    recipientCountsByLocale: {
      bg: { type: Number, default: 0, min: 0 },
      en: { type: Number, default: 0, min: 0 },
    },
    totalRecipients: {
      type: Number,
      default: 0,
      min: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'newsletter_campaigns',
    timestamps: true,
  }
);

newsletterCampaignSchema.index({ createdAt: -1 }, { background: true });
newsletterCampaignSchema.index({ status: 1, createdAt: 1 }, { background: true });

export default mongoose.models.NewsletterCampaign ||
  mongoose.model('NewsletterCampaign', newsletterCampaignSchema);
