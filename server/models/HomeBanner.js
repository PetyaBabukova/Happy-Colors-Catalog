import mongoose from 'mongoose';

const homeBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required!'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [600, 'Description cannot be longer than 600 characters.'],
    },
    ctaLabel: {
      type: String,
      required: [true, 'CTA label is required!'],
      trim: true,
      maxlength: 60,
    },
    ctaHref: {
      type: String,
      required: [true, 'CTA href is required!'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required!'],
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

homeBannerSchema.index({ isActive: 1, sortOrder: 1, createdAt: 1 });
homeBannerSchema.index({ imageUrl: 1 });

export default mongoose.models.HomeBanner || mongoose.model('HomeBanner', homeBannerSchema);
