import type { MetadataRoute } from "next";

const site = (process.env.NEXT_PUBLIC_APP_URL ?? "https://nfgcord.com").replace(/\/+$/, "");

/** The public pages, for search engines. The signed-in app isn't listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["/", "weekly", 1],
    ["/features", "monthly", 0.9],
    ["/pricing", "monthly", 0.9],
    ["/download", "weekly", 0.8],
    ["/developer", "monthly", 0.6],
    ["/support", "weekly", 0.8],
    ["/about", "yearly", 0.5],
    ["/beta", "weekly", 0.6],
    ["/leaderboards", "daily", 0.4],
    ["/legal", "monthly", 0.3],
    ["/legal/terms", "monthly", 0.3],
    ["/legal/privacy", "monthly", 0.3],
    ["/login", "yearly", 0.2],
    ["/register", "yearly", 0.5],
  ];
  return pages.map(([path, changeFrequency, priority]) => ({ url: `${site}${path}`, lastModified: now, changeFrequency, priority }));
}
