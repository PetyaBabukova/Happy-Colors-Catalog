import 'dotenv/config';
import mongoose from 'mongoose';

import { HOMEPAGE_FEATURED_PRODUCTS_LIMIT } from '../server/config/homepageFeaturedProducts.js';
import Product from '../server/models/Product.js';

async function seedHomepageFeaturedProducts() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(mongoUri);

  const existingFeaturedCount = await Product.countDocuments({ isHomepageFeatured: true });

  if (existingFeaturedCount > 0) {
    console.log('Homepage featured products already exist. Skipping seed.');
    return;
  }

  const products = await Product.find({ availability: { $ne: 'unavailable' } })
    .sort({ _id: 1 })
    .limit(HOMEPAGE_FEATURED_PRODUCTS_LIMIT)
    .lean();

  if (products.length === 0) {
    console.log('No available products found. Nothing to seed.');
    return;
  }

  await Promise.all(
    products.map((product, index) =>
      Product.updateOne(
        { _id: product._id },
        {
          $set: {
            isHomepageFeatured: true,
            homepageFeaturedOrder: index,
          },
        }
      )
    )
  );

  console.log(`Seeded ${products.length} homepage featured products.`);
}

seedHomepageFeaturedProducts()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
