import type { Metadata } from "next";
import { DeveloperAccessGate } from "@/components/developer/developer-access-gate";
import { DeveloperShell } from "@/components/developer/developer-shell";

export const metadata: Metadata = {
  title: "Developer Portal",
  description: "Read the app updates and browse public bots in the Nexus Forge Gaming developer section. Sign in to create and manage your own.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeveloperAccessGate>
      <DeveloperShell>{children}</DeveloperShell>
    </DeveloperAccessGate>
  );
}
