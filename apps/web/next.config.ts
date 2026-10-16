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
  async headers() {
    if (process.env.NODE_ENV !== "production") return []; // the dev server needs inline and eval scripts
    return [
      {
        source: "/:path*",
        headers: [
          // Only reports for now (the browser console shows what would be blocked); switch to
          // "Content-Security-Policy" once nothing is reported. It limits what an injected script could do.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
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
