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
});

export default nextConfig;
