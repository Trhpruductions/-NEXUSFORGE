import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { AppShell } from "@/components/layout/vexora-shell";

export const metadata: Metadata = {
  title: "Nexus Forge Gaming Workspace",
  description: "Nexus Forge Gaming: built for gamers, connected by community.",
};

// Every page under /app is private: the shell (and its server name, channels and avatar) only renders
// once the session is confirmed, and signed-out visitors are sent to /login.
export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
