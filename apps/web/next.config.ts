import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Avoid stale/missing chunk references in Windows dev sessions.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
