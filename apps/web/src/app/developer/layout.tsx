import type { Metadata } from "next";
import { DeveloperShell } from "@/components/developer/developer-shell";

export const metadata: Metadata = {
  title: "Developer Portal | Vexora Gaming",
  description: "Create bots, manage applications, and publish integrations in the Vexora Gaming developer portal.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
