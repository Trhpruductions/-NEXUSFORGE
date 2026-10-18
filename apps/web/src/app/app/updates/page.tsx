import type { Metadata } from "next";
import { UpdatesPage } from "@/components/updates/updates-page";

export const metadata: Metadata = { title: "What's new", description: "New features and fixes in Nexus Forge Gaming." };

export default function AppUpdatesPage() {
  return <UpdatesPage />;
}
