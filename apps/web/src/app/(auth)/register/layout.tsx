import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a free Nexus Forge Gaming account. You must be 18 or older to join.",
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
