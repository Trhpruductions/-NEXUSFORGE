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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: titles[slug] ?? "Legal Center", description: "Part of the Nexus Forge Gaming Legal Center." };
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense>
      <LegalCenter slug={slug} />
    </Suspense>
  );
}
