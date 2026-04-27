import mongoose from 'mongoose';

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

const productSchema = new mongoose.Schema({
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
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);
