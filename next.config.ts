import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const configuredApiBaseUrl = (process.env.SPINE_API_BASE_URL ?? "http://127.0.0.1:8000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");

const nextConfig: NextConfig = {
  // Workspace automation owns the generated repository instructions.
  agentRules: false,
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
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
