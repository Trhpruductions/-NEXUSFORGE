import type { Metadata } from "next";
import { DownloadsPage } from "@/components/downloads/downloads-page";

export const metadata: Metadata = { title: "Downloads", description: "Vexora Gaming for Windows." };

export default function AppDownloadsPage() {
  return <DownloadsPage />;
}
