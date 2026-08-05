import mongoose from 'mongoose';
import validator from 'validator';
import { PUBLIC_LOCALES } from './localizationSchemas.js';

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: validator.isEmail,
        message: 'Invalid email address.',
      },
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active',
      index: true,
    },
    consentGivenAt: {
      type: Date,
      required: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    firstSubscribedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastSubscribedAt: {
      type: Date,
      default: null,
      index: true,
    },
    subscribeCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    hasEverUnsubscribed: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastStatusChangedAt: {
      type: Date,
      default: null,
      index: true,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    unsubscribeTokenVersion: {
      type: Number,
      default: 1,
    },
    welcomeEmailSentAt: {
      type: Date,
      default: null,
    },
    preferredLocale: {
      type: String,
      enum: PUBLIC_LOCALES,
      default: 'bg',
      required: true,
    },
    pendingPreferredLocale: {
      type: String,
      enum: PUBLIC_LOCALES,
      default: null,
    },
    pendingLocaleRequestedAt: {
      type: Date,
      default: null,
    },
    localeChangeRequestVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    preferenceTokenVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    consecutiveUndeliveredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);

export default NewsletterSubscriber;
