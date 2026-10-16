import { Suspense } from "react";
import type { Metadata } from "next";
import { LegalCenter } from "@/components/legal/legal-center";

const titles: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  eula: "End User License Agreement",
  "acceptable-use": "Acceptable Use Policy",
  "community-rules": "Community Rules",
  refunds: "Refund Policy",
  cookies: "Cookie Policy",
  ip: "Intellectual Property Policy",
  moderation: "Moderation Policy",
  appeals: "Appeals Policy",
};

/**
 * Keeps the policy text at a comfortable reading width (about 72 characters per line) on wide screens.
 * Only prose is capped; tables keep the full width and scroll sideways on phones.
 */
const proseWidth =
  "[&_.legal-doc>p]:max-w-[72ch] [&_.legal-doc>ul]:max-w-[72ch] [&_.legal-doc>ol]:max-w-[72ch] [&_.legal-doc>h1]:max-w-[72ch] [&_.legal-doc>h2]:max-w-[72ch] [&_.legal-doc>h3]:max-w-[72ch]";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = titles[slug];
  if (!title) return { title: "Legal Center", description: "Part of the Nexus Forge Gaming Legal Center." };
  return { title, description: `${title} for Nexus Forge Gaming, with its effective date and version history.` };
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense>
      <div className={proseWidth}>
        <LegalCenter slug={slug} />
      </div>
    </Suspense>
  );
}
