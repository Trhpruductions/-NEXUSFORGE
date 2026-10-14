import type { Metadata } from "next";
import { SupportPage } from "@/components/support/support-page";

export const metadata: Metadata = { title: "Support", description: "Open a ticket and talk to the Nexus Forge team." };

export default function AppSupportPage() {
  return <SupportPage />;
}
