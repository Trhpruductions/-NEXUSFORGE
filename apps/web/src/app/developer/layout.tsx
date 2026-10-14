import type { Metadata } from "next";
import { DeveloperShell } from "@/components/developer/developer-shell";

export const metadata: Metadata = {
  title: "Developer Portal | Nexus Forge Gaming",
  description: "Create bots, manage applications, and publish integrations in the Nexus Forge Gaming developer portal.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
