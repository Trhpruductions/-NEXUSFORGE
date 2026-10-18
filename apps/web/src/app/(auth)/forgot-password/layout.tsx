import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Nexus Forge Gaming password with an emailed link, or a code texted to your verified phone.",
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
