import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/vexora-shell";

export const metadata: Metadata = {
  title: "Nexus Forge Gaming Workspace",
  description: "Nexus Forge Gaming: built for gamers, connected by community.",
};

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
