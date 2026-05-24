import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppRouteShell } from "@/components/layout/app-route-shell";

export const metadata: Metadata = {
  title: "NexusForge Command Center",
  description: "Premium NexusForge app experience for live raids, chat, voice, and community operations.",
};

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
