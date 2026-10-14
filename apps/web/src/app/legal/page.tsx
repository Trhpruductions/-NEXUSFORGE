import { Suspense } from "react";
import type { Metadata } from "next";
import { LegalCenter } from "@/components/legal/legal-center";

export const metadata: Metadata = {
  title: "Legal Center",
  description: "Nexus Forge Gaming's terms, policies and agreements, with their effective dates and history.",
};

export default function LegalIndexPage() {
  return (
    <Suspense>
      <LegalCenter slug={null} />
    </Suspense>
  );
}
