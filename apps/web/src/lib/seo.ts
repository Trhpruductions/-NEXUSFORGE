import type { Metadata } from "next";

const SITE_NAME = "Nexus Forge Gaming";
const PREVIEW_IMAGE = "/opengraph-image.png";

/**
 * Page-level metadata for public pages: its own title, description, canonical link, and social preview.
 * Next.js replaces the layout's openGraph and twitter objects as a whole, so both are repeated here.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [PREVIEW_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [PREVIEW_IMAGE],
    },
  };
}
