import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppRouteShell } from "@/components/layout/app-route-shell";

export const metadata: Metadata = {
  title: "Vexora Gaming Workspace",
  description: "A calmer Vexora Gaming workspace for teams, updates, and community coordination.",
};

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
