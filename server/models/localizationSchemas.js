import mongoose from 'mongoose';

export const TARGET_TRANSLATION_LOCALES = Object.freeze(['en']);
export const PUBLIC_LOCALES = Object.freeze(['bg', 'en']);
export const TRANSLATION_METHOD_VALUES = Object.freeze([
  'machine',
  'manual',
  'accepted_unchanged',
]);

const translationMetadataFields = {
  sourceRevision: {
    type: Number,
    required: true,
    min: 1,
  },
  translationRevision: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  method: {
    type: String,
    enum: TRANSLATION_METHOD_VALUES,
    required: true,
  },
  translatedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  translatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  provider: {
    type: String,
    default: '',
    trim: true,
    maxlength: 80,
  },
  providerModel: {
    type: String,
    default: '',
    trim: true,
    maxlength: 120,
  },
};

function readMapKeys(value) {
  if (!value) {
    return [];
  }

  if (value instanceof Map || typeof value.keys === 'function') {
    return [...value.keys()];
  }

  if (typeof value === 'object') {
    return Object.keys(value);
  }

  return [];
}

function validateTargetLocaleMap(value) {
  return readMapKeys(value).every((key) => TARGET_TRANSLATION_LOCALES.includes(String(key)));
}

function createTranslationSchema(fields) {
  return new mongoose.Schema(
    {
      ...fields,
      ...translationMetadataFields,
    },
    { _id: false }
  );
}

export function createTranslationMapSchema(fields) {
  return {
    type: Map,
    of: createTranslationSchema(fields),
    default: undefined,
    validate: {
      validator: validateTargetLocaleMap,
      message: 'Unsupported translation locale.',
    },
  };
}

export function createTranslationDraftMapSchema(fields) {
  return {
    type: Map,
    of: createTranslationSchema({
      ...fields,
      draftRevision: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
    }),
    default: undefined,
    validate: {
      validator: validateTargetLocaleMap,
      message: 'Unsupported translation draft locale.',
    },
  };
}
