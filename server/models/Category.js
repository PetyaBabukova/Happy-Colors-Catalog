import mongoose from 'mongoose';
import { createTranslationMapSchema } from './localizationSchemas.js';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Името е задължително.'],
    minlength: [2, 'Минимална дължина: 2 знака.'],
    unique: [true, 'Категорията вече съществува.'],
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  canonicalSlug: {
    type: String,
    default: '',
    trim: true,
    maxlength: 140,
  },
  canonicalSlugReviewed: {
    type: Boolean,
    default: false,
  },
  slugAliases: {
    type: [String],
    default: [],
  },
  sourceRevision: {
    type: Number,
    default: 1,
    min: 1,
    required: true,
  },
  translations: createTranslationMapSchema({
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  }),
});

export default mongoose.model('Category', categorySchema);
