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

/** Video players members can embed in chat and on the Live page (components/media/clip-embed.tsx). */
const EMBED_FRAME_HOSTS = ["https://www.youtube.com", "https://clips.twitch.tv", "https://player.twitch.tv", "https://kick.com", "https://player.kick.com", "https://streamable.com"];
/** Chat uploads go from the browser straight to Cloudflare R2 with a presigned link (chat-page.tsx). */
const UPLOAD_HOSTS = ["https://*.r2.cloudflarestorage.com"];
export const CSP_REPORT_GROUP = "csp";

/**
 * Content-Security-Policy in two parts.
 * - `enforced`: rules no page relies on breaking (no <base> tag, forms only post here, nobody frames us).
 * - `reportOnly`: the full policy. Browsers don't block anything with it, they only report what it would
 *   block to /api/errors/csp (shown on the admin Errors page). Once the reports are clean it can be enforced.
 * Inline scripts stay allowed: Next.js writes its page data as inline scripts, and nonces would make every
 * page render per request. `apiOrigin` is set when the API lives on another origin (the private test site).
 */
export function contentSecurityPolicies(options: { dev: boolean; apiOrigin?: string | null }) {
  const api = options.apiOrigin ? new URL(options.apiOrigin) : null;
  const apiSources = api ? [api.origin, `${api.protocol === "https:" ? "wss:" : "ws:"}//${api.host}`] : [];
  const reportUri = api ? `${api.origin}/api/errors/csp` : "/api/errors/csp";
  // Chrome sends `report-to` reports to https addresses only, and ignores `report-uri` when `report-to` is set, so
  // over http (development, the private test site) only `report-uri` is used.
  const reportingApi = !options.dev && (!api || api.protocol === "https:");
  const enforced = ["base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"];
  const reportOnly = [
    "default-src 'self'",
    // React needs eval in development only, for its error overlays.
    `script-src 'self' 'unsafe-inline'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Avatars, link previews and attachments can come from any https site; crops and previews are blob:/data:.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...apiSources, ...UPLOAD_HOSTS].join(" "),
    // blob: is the ID-review screen's PDF viewer.
    ["frame-src 'self' blob:", ...EMBED_FRAME_HOSTS].join(" "),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    ...enforced,
    `report-uri ${reportUri}`,
    ...(reportingApi ? [`report-to ${CSP_REPORT_GROUP}`] : []),
  ];
  return { enforced: enforced.join("; "), reportOnly: reportOnly.join("; "), reportUri, reportingApi };
}

/**
 * Browser security headers for every page. The API sets its own (helmet); these cover the
 * website and the app shell.
 */
function securityHeaders(dev: boolean) {
  const csp = contentSecurityPolicies({ dev, apiOrigin: process.env.NEXT_PUBLIC_API_URL || null });
  return [
    // Only ever load this site over HTTPS for the next year (www included).
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    // Browsers must trust the declared content type (stops scripts hiding in "images").
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Nobody else may put our pages in a frame (clickjacking).
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Content-Security-Policy", value: csp.enforced },
    { key: "Content-Security-Policy-Report-Only", value: csp.reportOnly },
    ...(csp.reportingApi ? [{ key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${csp.reportUri}"` }] : []),
    // Don't leak full URLs (invite codes, reset links) to other sites.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Camera, mic and screen share are for the app itself; the rest is off.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}

const nextConfig = (phase: string): NextConfig => ({
  ...baseConfig,
  // Keep dev and production build artifacts isolated to prevent cross-mode chunk corruption. NF_BUILD_DIR lets a
  // check build go to its own folder, since .next-build is what the live site serves.
  distDir: process.env.NF_BUILD_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-build"),
  turbopack: {},
  poweredByHeader: false,
  // Serve images as they are. The on-the-fly optimizer failed for the large brand PNGs (blank logos on the home
  // page and elsewhere), and the originals are already sized for the screens that use them.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(phase === PHASE_DEVELOPMENT_SERVER) }];
  },
  // Old tester links from the first beta round.
  async redirects() {
    return [
      { source: "/beta/checklist", destination: "/beta", permanent: true },
      { source: "/beta/feedback", destination: "/support#report", permanent: true },
    ];
  },
  // Uploaded files use relative /uploads/... links; serve them from the API.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: `http://127.0.0.1:${process.env.API_PORT || 4001}/uploads/:path*` }];
  },
});

export default nextConfig;
