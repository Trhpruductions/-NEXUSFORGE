import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import { LegalCenter } from "@/components/legal/legal-center";

export const metadata = pageMetadata({
  title: "Legal Center",
  description: "Nexus Forge Gaming's terms, policies and agreements, with their effective dates and history.",
  path: "/legal",
});

export default function LegalIndexPage() {
  return (
    <Suspense>
      <LegalCenter slug={null} />
    </Suspense>
  );
}
