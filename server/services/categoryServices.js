import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { slugify } from '../utils/slugify.js';
import mongoose from 'mongoose'; 
import { buildPublicProductFilter } from '../utils/productPublication.js';


// 👉 Създаване на категория със slug
export async function createCategory(data) {
  const slug = slugify(data.name);
  const category = new Category({ ...data, slug });
  return await category.save();
}

// 👉 Връща всички категории (за create/edit форми)
export async function getAllCategories() {
  return await Category.find().lean();
}

// 👉 Връща само категориите, които имат поне 1 продукт (за хедър/shop)
export async function getVisibleCategories() {
  const categories = await Category.find().lean();

  const visibleCategories = [];

  for (const category of categories) {
    const productCount = await Product.countDocuments({
      ...buildPublicProductFilter(),
      category: category._id,
    });
    if (productCount > 0) {
      visibleCategories.push(category);
    }
  }

  return visibleCategories;
}

export async function deleteCategory(categoryId) {
  const categoryToDelete = await Category.findById(categoryId);

  if (!categoryToDelete) {
    throw new Error('Категорията не съществува.');
  }

  // Брой продукти, които използват тази категория
  const productCount = await Product.countDocuments({ category: categoryId });

  if (productCount === 0) {
    // Няма продукти → директно изтриваме категорията
    await Category.findByIdAndDelete(categoryId);
    return { message: 'Категорията беше изтрита успешно.', reassigned: false };
  }

  // Има продукти → намираме/създаваме категория "Други"
  let fallbackCategory = await Category.findOne({ name: 'Други' });

  if (!fallbackCategory) {
    fallbackCategory = new Category({
      name: 'Други',
      slug: slugify('Други'),
    });
    await fallbackCategory.save();
  }

  // Прехвърляме продуктите към категория "Други"
  await Product.updateMany(
    { category: categoryId },
    { category: fallbackCategory._id }
  );

  // Изтриваме оригиналната категория
  await Category.findByIdAndDelete(categoryId);

  return {
    message: `Категорията беше изтрита. Продуктите бяха прехвърлени към категория "${fallbackCategory.name}".`,
    reassigned: true,
  };
}

export async function getCategoryById(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new Error('Невалидно ID');
  }

  return await Category.findById(categoryId).lean();
}

export async function updateCategory(categoryId, data) {
  const slug = slugify(data.name);
  return await Category.findByIdAndUpdate(
    categoryId,
    { ...data, slug },
    { new: true, runValidators: true }
  );
}

