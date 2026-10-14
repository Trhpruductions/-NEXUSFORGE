import type { MetadataRoute } from "next";

const site = (process.env.NEXT_PUBLIC_APP_URL ?? "https://nfgcord.com").replace(/\/+$/, "");

/** Search engines may index the public website, not the signed-in app or the API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/admin/", "/api/", "/oauth/", "/invite/", "/welcome", "/age-gate"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
