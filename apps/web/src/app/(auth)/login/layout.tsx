import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Nexus Forge Gaming to pick up your forges, voice rooms, friends and rewards.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
