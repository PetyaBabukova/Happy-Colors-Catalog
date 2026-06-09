import mongoose from 'mongoose';

const uploadedObjectSchema = new mongoose.Schema(
  {
    objectName: {
      type: String,
      required: true,
      trim: true,
    },
    contentType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    originalName: {
      type: String,
      default: '',
      trim: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    claimedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    cleanupLockedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const cartoonUploadSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    uploadCount: {
      type: Number,
      default: 0,
    },
    uploadedObjects: {
      type: [uploadedObjectSchema],
      default: [],
    },
  },
  {
    collection: 'cartoon_upload_sessions',
    timestamps: false,
  }
);

cartoonUploadSessionSchema.index({ sessionId: 1 }, { unique: true, background: true });
cartoonUploadSessionSchema.index({ expiresAt: 1 }, { background: true });
cartoonUploadSessionSchema.index(
  { 'uploadedObjects.objectName': 1 },
  {
    unique: true,
    background: true,
    partialFilterExpression: { 'uploadedObjects.objectName': { $exists: true, $type: 'string' } },
  }
);

export default mongoose.models.CartoonUploadSession ||
  mongoose.model('CartoonUploadSession', cartoonUploadSessionSchema);
