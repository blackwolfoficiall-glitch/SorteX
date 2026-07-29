import type { NextConfig } from "next";

const apiInternalUrl = (
  process.env.API_INTERNAL_URL ||
  process.env.PLAYWRIGHT_API_URL ||
  "http://localhost:3333"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
  ],
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiInternalUrl}/:path*`,
        },
      ],
    };
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
