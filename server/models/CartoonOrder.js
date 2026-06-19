import mongoose from 'mongoose';

const cartoonOrderPhotoSchema = new mongoose.Schema(
  {
    photoId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
      trim: true,
      maxlength: 64,
    },
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
    // Опционален: общите запитвания нямат конкретен продукт.
    productSnapshot: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
      },
      title: { type: String, default: '', trim: true },
      price: { type: Number, min: 0, default: null },
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
      ordered: { type: Boolean, default: false },
      designApproved: { type: Boolean, default: false },
      paid: { type: Boolean, default: false },
    },
    workflowStatus: {
      type: String,
      enum: ['inquiry', 'waiting', 'ordered', 'completed'],
      default: 'inquiry',
      index: true,
    },
    inquiryAt: {
      type: Date,
      default: null,
    },
    waitingAt: {
      type: Date,
      default: null,
    },
    waitingBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    orderedAt: {
      type: Date,
      default: null,
    },
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    notifications: {
      admin: {
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
          default: 'pending',
        },
        error: {
          type: String,
          default: '',
          trim: true,
          maxlength: 300,
        },
        sentAt: {
          type: Date,
          default: null,
        },
      },
      customer: {
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
          default: 'pending',
        },
        error: {
          type: String,
          default: '',
          trim: true,
          maxlength: 300,
        },
        sentAt: {
          type: Date,
          default: null,
        },
      },
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
    abuseGuardReservationIds: {
      type: [String],
      default: [],
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
cartoonOrderSchema.index({ workflowStatus: 1, createdAt: -1 }, { background: true });
cartoonOrderSchema.index({ 'customer.email': 1, createdAt: -1 }, { background: true });
cartoonOrderSchema.index({ abuseGuardReservationIds: 1 }, { background: true });
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
