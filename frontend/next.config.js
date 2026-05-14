/** @type {import('next').NextConfig} */
const backendOrigin = (process.env.BENEPICK_BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: false,
  // main.js and i18n.js are served from public/ and rely on same-origin API access.
  // Rewrites keep browser requests on the current origin and proxy them to the backend.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/health',
        destination: `${backendOrigin}/health`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
