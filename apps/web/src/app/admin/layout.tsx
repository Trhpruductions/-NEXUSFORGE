import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/auth-gate";

// The moderation console needs a signed-in account before any of its pages draw. Staff rights are
// still checked by each page and by the API.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
