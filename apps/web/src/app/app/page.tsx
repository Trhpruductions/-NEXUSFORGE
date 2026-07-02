import type { Metadata } from "next";
import { AppHomeScreen } from "@/components/home/app-home-screen";

export const metadata: Metadata = {
  title: "NexusForge Workspace | Home",
  description: "NexusForge home dashboard for spaces, voice, and community coordination.",
};

export default function AppPage() {
  return <AppHomeScreen />;
}
