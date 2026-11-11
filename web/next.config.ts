import type { NextConfig } from "next";
import { FRAME_HEADERS, STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  headers: async () => [
    { source: "/:path*", headers: [...STATIC_SECURITY_HEADERS, ...FRAME_HEADERS.deny] },
    { source: "/sitio/:path*", headers: FRAME_HEADERS.sameOrigin },
  ],
  allowedDevOrigins: ["web-e2e"],
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
