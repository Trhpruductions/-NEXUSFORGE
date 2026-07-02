import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppRouteShell } from "@/components/layout/app-route-shell";

export const metadata: Metadata = {
  title: "NexusForge Workspace",
  description: "A calmer NexusForge workspace for teams, updates, and community coordination.",
};

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
