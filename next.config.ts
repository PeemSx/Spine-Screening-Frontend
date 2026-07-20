import type { NextConfig } from "next";

const configuredApiBaseUrl = (process.env.SPINE_API_BASE_URL ?? "http://127.0.0.1:8000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/spine-api/:path*",
        destination: `${configuredApiBaseUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
