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
        source: '/api/cartoon-orders',
        destination: `${backendBaseUrl}/cartoon-orders`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/statuses',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/statuses`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/admin-notes',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/admin-notes`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/workflow',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/workflow`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/reject',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/reject`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/complete',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/complete`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/photo-diagnostics',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/photo-diagnostics`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/photos/:photoId([A-Za-z0-9_-]{1,80})',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/photos/:photoId`,
      },
      {
        source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/notifications/retry',
        destination: `${backendBaseUrl}/cartoon-orders/:orderId/notifications/retry`,
      },
      {
        source: '/api/cartoon-orders/purge-old-completed',
        destination: `${backendBaseUrl}/cartoon-orders/purge-old-completed`,
      },
      {
        source: '/api/cartoon-orders/upload-cleanup/status',
        destination: `${backendBaseUrl}/cartoon-orders/upload-cleanup/status`,
      },
      {
        source: '/api/cartoon-orders/upload-cleanup/run',
        destination: `${backendBaseUrl}/cartoon-orders/upload-cleanup/run`,
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
      {
        source: '/api/translations/:path*',
        destination: `${backendBaseUrl}/translations/:path*`,
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
