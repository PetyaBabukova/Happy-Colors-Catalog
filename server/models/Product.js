import mongoose from 'mongoose';
import {
  PRODUCT_PUBLICATION_STATUS_VALUES,
  PRODUCT_PUBLICATION_STATUSES,
  PRODUCT_REVIEW_STATUS_VALUES,
  PRODUCT_REVIEW_STATUSES,
} from '../utils/productPublication.js';
import { createTranslationMapSchema } from './localizationSchemas.js';

const productVideoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    posterUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const productDraftContentSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    price: Number,
    imageUrl: {
      type: String,
      default: '',
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    videos: {
      type: [productVideoSchema],
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    availability: {
      type: String,
      enum: ['available', 'unavailable'],
      default: 'available',
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required!"],
    },
    description: {
      type: String,
      required: [true, "Description is required!"],
    },
    sourceRevision: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
    },
    translations: createTranslationMapSchema({
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },
      description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10000,
      },
    }),
    price: {
      type: Number,
      required: [true, "Price is required!"],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    videos: {
      type: [productVideoSchema],
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, "Category is required!"],
    },
    availability: {
      type: String,
      enum: ['available', 'unavailable'],
      default: 'available',
      required: true,
    },
    isHomepageFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    homepageFeaturedOrder: {
      type: Number,
      default: 0,
    },
    isInCatalog: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCartoonGallery: {
      type: Boolean,
      default: false,
      index: true,
    },
    feedback: [
      {
        name: String,
        comment: String,
        rating: Number,
      }
    ],
    accessories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Accessory'
      }
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "Owner is required!"],
    },
    publicationStatus: {
      type: String,
      enum: PRODUCT_PUBLICATION_STATUS_VALUES,
      default: PRODUCT_PUBLICATION_STATUSES.DRAFT,
      required: true,
      index: true,
    },
    reviewNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    reviewStatus: {
      type: String,
      enum: PRODUCT_REVIEW_STATUS_VALUES,
      default: PRODUCT_REVIEW_STATUSES.NONE,
      required: true,
      index: true,
    },
    draftContent: {
      type: productDraftContentSchema,
      default: null,
    },
    draftRevision: {
      type: Number,
      default: 0,
    },
    draftUpdatedAt: {
      type: Date,
      default: null,
    },
    draftSubmittedAt: {
      type: Date,
      default: null,
    },
    draftSubmittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

productSchema.index({ isHomepageFeatured: 1, homepageFeaturedOrder: 1, _id: 1 });
productSchema.index({ publicationStatus: 1, updatedAt: 1 });
productSchema.index({ reviewStatus: 1, draftSubmittedAt: 1 });
productSchema.index({ owner: 1, publicationStatus: 1, updatedAt: -1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);
