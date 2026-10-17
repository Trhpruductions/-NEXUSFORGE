import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Forge invite",
  description: "Review a Nexus Forge Gaming server invite, then join it once you are signed in.",
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return children;
}
