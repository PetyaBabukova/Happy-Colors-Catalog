import mongoose from 'mongoose';

const blogArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    contentHtml: {
      type: String,
      required: true,
    },
    contentJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    contentText: {
      type: String,
      default: '',
      trim: true,
    },
    excerpt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    heroImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    heroImageAlt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    seoTitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 70,
    },
    seoDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 170,
    },
    status: {
      type: String,
      enum: ['published'],
      default: 'published',
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    newsletterReady: {
      type: Boolean,
      default: false,
    },
    newsletterSentAt: {
      type: Date,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

blogArticleSchema.index({ status: 1, archivedAt: 1, publishedAt: -1, createdAt: -1 });
blogArticleSchema.index({ archivedAt: 1, updatedAt: -1 });

export default mongoose.models.BlogArticle || mongoose.model('BlogArticle', blogArticleSchema);
