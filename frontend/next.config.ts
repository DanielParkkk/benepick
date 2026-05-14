import type { NextConfig } from "next";

const backendOrigin = (process.env.BENEPICK_BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${backendOrigin}/health`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
