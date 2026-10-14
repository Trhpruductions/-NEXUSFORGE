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

/**
 * Browser security headers for every page. The API sets its own (helmet); these cover the
 * website and the app shell. No full Content-Security-Policy yet: the app uses inline styles,
 * socket.io, Stripe Checkout and uploaded media, so an enforced policy needs its own rollout.
 */
const securityHeaders = [
  // Only ever load this site over HTTPS for the next year (www included).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Browsers must trust the declared content type (stops scripts hiding in "images").
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nobody else may put our pages in a frame (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  // Don't leak full URLs (invite codes, reset links) to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera, mic and screen share are for the app itself; the rest is off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = (phase: string): NextConfig => ({
  ...baseConfig,
  // Keep dev and production build artifacts isolated to prevent cross-mode chunk corruption.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-build",
  turbopack: {},
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Uploaded files use relative /uploads/... links; serve them from the API.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: `http://127.0.0.1:${process.env.API_PORT || 4001}/uploads/:path*` }];
  },
});

export default nextConfig;
