import type { Metadata } from "next";
import { LivePage } from "@/components/live/live-page";

export const metadata: Metadata = { title: "Live Now", description: "Creators streaming right now." };

export default function AppLivePage() {
  return <LivePage />;
}
