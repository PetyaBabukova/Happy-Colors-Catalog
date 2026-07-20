import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { buildPublicProductFilter } from '../utils/productPublication.js';
import { projectPublicProduct } from './localization/publicProjection.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchVariants(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = normalizedQuery
    .split(/[\s,.-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const variants = new Set([normalizedQuery, ...tokens]);
  const suffixes = ['ове', 'еве', 'ът', 'ят', 'та', 'то', 'те', 'ки', 'ци', 'и', 'а', 'я'];

  for (const token of tokens) {
    for (const suffix of suffixes) {
      if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
        variants.add(token.slice(0, -suffix.length));
      }
    }
  }

  return Array.from(variants)
    .map((variant) => variant.trim())
    .filter((variant) => variant.length >= 2);
}

function buildRegexConditions(fields, variants) {
  return fields.flatMap((field) =>
    variants.map((variant) => ({
      [field]: { $regex: escapeRegex(variant), $options: 'i' },
    }))
  );
}

export async function searchProducts(query, { locale = 'bg' } = {}) {
  if (!query || query.trim() === '') return [];

  const variants = buildSearchVariants(query);
  const categorySearchFields = ['name', 'slug', 'canonicalSlug', 'slugAliases'];
  const productSearchFields = ['title', 'description'];

  if (locale === 'en') {
    categorySearchFields.push('translations.en.name');
    productSearchFields.push('translations.en.title', 'translations.en.description');
  }

  const matchingCategories = await Category.find({
    $or: buildRegexConditions(categorySearchFields, variants),
  }).select('_id');

  const categoryIds = matchingCategories.map((cat) => cat._id);

  const productTextConditions = buildRegexConditions(productSearchFields, variants);

  const products = await Product.find({
    ...buildPublicProductFilter(),
    $or: [
      ...productTextConditions,
      ...(categoryIds.length > 0 ? [{ category: { $in: categoryIds } }] : []),
    ],
  })
    .populate('category', 'name slug canonicalSlug slugAliases translations sourceRevision')
    .lean();

  return products.map((product) => projectPublicProduct(product, locale));
}
