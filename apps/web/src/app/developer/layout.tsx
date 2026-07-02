import type { Metadata } from "next";
import { DeveloperShell } from "@/components/developer/developer-shell";

export const metadata: Metadata = {
  title: "Developer Portal | NexusForge",
  description: "Create bots, manage applications, and publish integrations in the NexusForge developer portal.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
