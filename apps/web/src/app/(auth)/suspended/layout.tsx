import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Account status",
  description: "This Nexus Forge Gaming account is suspended or banned. The appeals policy explains how to ask for a review.",
};

export default function SuspendedLayout({ children }: { children: ReactNode }) {
  return children;
}
