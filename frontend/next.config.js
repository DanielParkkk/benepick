/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // main.js, i18n.js는 public에서 직접 서빙
  // 외부 Script 로드를 위한 도메인 허용
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

module.exports = nextConfig;
