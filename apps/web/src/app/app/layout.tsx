import type { Metadata } from "next";
import type { ReactNode } from "react";
import { VexoraShell } from "@/components/layout/vexora-shell";

export const metadata: Metadata = {
  title: "Vexora Gaming Workspace",
  description: "Vexora Gaming: built for gamers, connected by community.",
};

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return <VexoraShell>{children}</VexoraShell>;
}
