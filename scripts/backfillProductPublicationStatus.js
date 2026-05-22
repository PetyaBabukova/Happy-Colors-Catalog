import { fileURLToPath } from 'url';
import mongoose from '../server/mongoose.js';
import Product from '../server/models/Product.js';
import User from '../server/models/User.js';
import {
  PRODUCT_PUBLICATION_STATUSES,
  PRODUCT_PUBLICATION_STATUS_VALUES,
} from '../server/utils/productPublication.js';

export async function backfillProductPublicationStatus() {
  const invalidStatusResult = await Product.updateMany(
    {
      $or: [
        { publicationStatus: { $exists: false } },
        { publicationStatus: { $nin: PRODUCT_PUBLICATION_STATUS_VALUES } },
      ],
    },
    { $set: { publicationStatus: PRODUCT_PUBLICATION_STATUSES.PUBLISHED } }
  );

  const products = await Product.find({}, { owner: 1, title: 1, publicationStatus: 1 }).lean();
  const ownerIds = [...new Set(products.map((product) => String(product.owner || '')).filter(Boolean))];
  const existingOwners = await User.find({ _id: { $in: ownerIds } }, { _id: 1 }).lean();
  const existingOwnerIds = new Set(existingOwners.map((owner) => String(owner._id)));
  const productsWithMissingOwners = products
    .filter((product) => !product.owner || !existingOwnerIds.has(String(product.owner)))
    .map((product) => ({
      _id: String(product._id),
      title: product.title,
      owner: product.owner ? String(product.owner) : null,
    }));

  return {
    matchedCount: invalidStatusResult.matchedCount,
    modifiedCount: invalidStatusResult.modifiedCount,
    productsWithMissingOwners,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const result = await backfillProductPublicationStatus();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
