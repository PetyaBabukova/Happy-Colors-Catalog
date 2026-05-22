import mongoose from 'mongoose';
import { PRODUCT_PUBLICATION_STATUS_VALUES, PRODUCT_PUBLICATION_STATUSES } from '../utils/productPublication.js';

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
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

productSchema.index({ isHomepageFeatured: 1, homepageFeaturedOrder: 1, _id: 1 });
productSchema.index({ publicationStatus: 1, updatedAt: 1 });
productSchema.index({ owner: 1, publicationStatus: 1, updatedAt: -1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);
