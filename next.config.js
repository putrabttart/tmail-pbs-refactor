/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['googleapis']
  },
  // Performance optimizations
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  // Optimize images if any are used
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  // Headers for caching static assets
  async headers() {
    return [
      {
        source: '/api/domains',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }
        ]
      },
      {
        source: '/api/theme',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
