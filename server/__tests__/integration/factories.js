import jwt from 'jsonwebtoken';
import Category from '../../models/Category.js';
import BlogArticle from '../../models/BlogArticle.js';
import HomeBanner from '../../models/HomeBanner.js';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';

let sequence = 0;

export function resetSequence() {
  sequence = 0;
}

function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function buildUser(overrides = {}) {
  const id = nextId('user');

  return {
    username: `Petya${sequence}`,
    email: `${id}@example.com`,
    password: 'StrongPass1!',
    ...overrides,
  };
}

export async function createUser(overrides = {}) {
  return User.create(buildUser(overrides));
}

export function buildCategory(overrides = {}) {
  const id = nextId('category');

  return {
    name: `Category ${id}`,
    slug: `category-${id}`,
    ...overrides,
  };
}

export async function createCategory(overrides = {}) {
  return Category.create(buildCategory(overrides));
}

export function buildProduct({ category, owner, ...overrides } = {}) {
  return {
    title: 'Colorful Candle',
    description: 'Handmade candle with bright colors',
    price: 12.5,
    imageUrl: 'https://cdn.example.com/candle.webp',
    imageUrls: ['https://cdn.example.com/candle.webp'],
    category: category?._id || category,
    owner: owner?._id || owner,
    availability: 'available',
    ...overrides,
  };
}

export async function createProduct(overrides = {}) {
  const owner = overrides.owner || (await createUser());
  const category = overrides.category || (await createCategory());

  return Product.create(buildProduct({ ...overrides, owner, category }));
}

export function buildHomeBanner({ owner, ...overrides } = {}) {
  const id = nextId('home-banner');

  return {
    title: `Home Banner ${id}`,
    description: 'Homepage banner description',
    ctaLabel: 'View collection',
    ctaHref: '/search?q=животинки',
    imageUrl: `https://storage.googleapis.com/test-bucket/home-banners/${id}.webp`,
    sortOrder: 0,
    isActive: true,
    owner: owner?._id || owner,
    ...overrides,
  };
}

export async function createHomeBanner(overrides = {}) {
  const owner = overrides.owner || (await createUser());

  return HomeBanner.create(buildHomeBanner({ ...overrides, owner }));
}

export function buildBlogArticle({ owner, ...overrides } = {}) {
  const id = nextId('blog-article');

  return {
    title: `Blog Article ${id}`,
    contentHtml: '<p>Helpful colorful article body.</p>',
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Helpful colorful article body.' }],
        },
      ],
    },
    heroImageUrl: `https://storage.googleapis.com/test-bucket/blog/articles/hero/${id}.webp`,
    thumbnailImageUrl: `https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/${id}.webp`,
    heroImageAlt: `Hero image for ${id}`,
    status: 'published',
    publishedAt: new Date(),
    owner: owner?._id || owner,
    ...overrides,
  };
}

export async function createBlogArticle(overrides = {}) {
  const owner = overrides.owner || (await createUser());

  return BlogArticle.create(buildBlogArticle({ ...overrides, owner }));
}

/**
 * Builds the flat request body shape consumed by POST /orders.
 */
export function buildOrder({ product, ...overrides } = {}) {
  return {
    name: 'Petya Babukova',
    email: 'petya@example.com',
    phone: '+359888123456',
    city: 'Sofia',
    address: 'Main street 1',
    paymentMethod: 'cod',
    shippingMethod: 'econt',
    econtOffice: 'Econt office 1',
    cartItems: [
      {
        productId: String(product?._id || product),
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

/**
 * Creates an Order document directly with the nested Mongo schema shape.
 */
export async function createOrder(overrides = {}) {
  const product = overrides.product || (await createProduct());

  return Order.create({
    customer: {
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      city: 'Sofia',
      address: 'Main street 1',
    },
    shipping: {
      shippingMethod: 'econt',
      econtOffice: 'Econt office 1',
    },
    paymentMethod: 'cod',
    items: [{ productId: product._id, title: product.title, quantity: 1, unitPrice: product.price }],
    totalPrice: product.price,
    ...overrides,
  });
}

export function buildCheckoutDraft(overrides = {}) {
  return {
    email: 'petya@example.com',
    cartItems: [],
    totalPrice: 0,
    ...overrides,
  };
}

export function authCookie(user) {
  const token = jwt.sign(
    {
      _id: String(user._id),
      username: user.username,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return `token=${token}`;
}
