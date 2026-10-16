import type { Metadata } from "next";
import { AuthGate } from "@/components/layout/auth-gate";
import { DeveloperShell } from "@/components/developer/developer-shell";

export const metadata: Metadata = {
  title: "Developer Portal",
  description: "Create bots, manage applications, and publish integrations in the Nexus Forge Gaming developer portal.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <DeveloperShell>{children}</DeveloperShell>
    </AuthGate>
  );
}
