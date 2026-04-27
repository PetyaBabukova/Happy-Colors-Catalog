/** @type {import('next').NextConfig} */
const backendBaseUrl = String(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'http://localhost:3030'
).replace(/\/+$/, '');

const nextConfig = {
  serverExternalPackages: ['mongoose', 'mongodb'],
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
        pathname: '/**',              // леко поправям от '**' на '/**'
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/happycolors-store/**', // пътят към твоя bucket
      },
    ],
  },
};

export default nextConfig;
