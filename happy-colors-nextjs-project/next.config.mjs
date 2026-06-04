import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const backendBaseUrl = String(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'http://localhost:3030'
).replace(/\/+$/, '');
const gcsBucketName = String(
  process.env.GCS_BUCKET_NAME ||
  process.env.NEXT_PUBLIC_GCS_BUCKET_NAME ||
  'happycolors-store'
).replace(/^\/+|\/+$/g, '');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  serverExternalPackages: ['mongoose', 'mongodb'],
  async headers() {
    return [
      {
        source: '/newsletter/confirm',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=0, no-store',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/users/:path*',
        destination: `${backendBaseUrl}/users/:path*`,
      },
      {
        source: '/api/products/:path*',
        destination: `${backendBaseUrl}/products/:path*`,
      },
      {
        source: '/api/home-banners/:path*',
        destination: `${backendBaseUrl}/home-banners/:path*`,
      },
      {
        source: '/api/blog-articles/:path*',
        destination: `${backendBaseUrl}/blog-articles/:path*`,
      },
      {
        source: '/api/categories/:path*',
        destination: `${backendBaseUrl}/categories/:path*`,
      },
      {
        source: '/api/search/:path*',
        destination: `${backendBaseUrl}/search/:path*`,
      },
      {
        source: '/api/contacts/:path*',
        destination: `${backendBaseUrl}/contacts/:path*`,
      },
      {
        source: '/api/newsletter/:path*',
        destination: `${backendBaseUrl}/newsletter/:path*`,
      },
      {
        source: '/api/orders/:path*',
        destination: `${backendBaseUrl}/orders/:path*`,
      },
      {
        source: '/api/payments/:path*',
        destination: `${backendBaseUrl}/payments/:path*`,
      },
      {
        source: '/api/delivery/:path*',
        destination: `${backendBaseUrl}/delivery/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdncloudcart.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: `/${gcsBucketName}/**`,
      },
    ],
  },
};

export default nextConfig;
