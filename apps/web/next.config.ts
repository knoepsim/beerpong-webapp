import type { NextConfig } from "next";

// Hostnames (no port) the dev server may be opened on besides localhost, e.g. a phone in the same network:
// ALLOWED_DEV_ORIGINS=192.168.137.1 in .env.local
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  experimental: {
    // The live view is a stream that stays open (the API ends it after 10 minutes); the proxy default is 30 s
    proxyTimeout: 12 * 60 * 1000,
  },
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
