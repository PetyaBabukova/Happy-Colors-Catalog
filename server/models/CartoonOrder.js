import mongoose from 'mongoose';

const cartoonOrderPhotoSchema = new mongoose.Schema(
  {
    objectName: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 255,
    },
    contentType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadSessionId: {
      type: String,
      required: true,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const cartoonOrderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, default: '', trim: true },
      message: { type: String, required: true, trim: true },
    },
    productSnapshot: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product',
      },
      title: { type: String, required: true, trim: true },
      price: { type: Number, required: true, min: 0 },
      imageUrl: { type: String, default: '', trim: true },
    },
    photos: {
      type: [cartoonOrderPhotoSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one reference photo is required.',
      },
    },
    statuses: {
      ordered: { type: Boolean, default: true },
      designApproved: { type: Boolean, default: false },
      paid: { type: Boolean, default: false },
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    notificationStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    notificationError: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    claimStatus: {
      type: String,
      enum: ['pending', 'claimed', 'failed'],
      default: 'pending',
      index: true,
    },
    claimFailureReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    requiresAdminAttention: {
      type: Boolean,
      default: false,
      index: true,
    },
    consentAccepted: {
      type: Boolean,
      required: true,
    },
    consentAcceptedAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

cartoonOrderSchema.index({ archivedAt: 1, createdAt: -1 }, { background: true });
cartoonOrderSchema.index({ completedAt: 1, createdAt: -1 }, { background: true });
cartoonOrderSchema.index({ 'customer.email': 1, createdAt: -1 }, { background: true });
cartoonOrderSchema.index(
  { 'photos.objectName': 1 },
  {
    unique: true,
    background: true,
    partialFilterExpression: { 'photos.objectName': { $exists: true, $type: 'string' } },
  }
);

export default mongoose.models.CartoonOrder ||
  mongoose.model('CartoonOrder', cartoonOrderSchema);
