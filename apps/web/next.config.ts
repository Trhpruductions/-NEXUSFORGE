import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Avoid stale/missing chunk references in Windows dev sessions.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

const nextConfig = (phase: string): NextConfig => ({
  ...baseConfig,
  // Keep dev and production build artifacts isolated to prevent cross-mode chunk corruption.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-build",
  turbopack: {},
  // Uploaded files use relative /uploads/... links; serve them from the API.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: `http://127.0.0.1:${process.env.API_PORT || 4001}/uploads/:path*` }];
  },
});

export default nextConfig;
