import type { Metadata } from "next";
import { AppHomeScreen } from "@/components/home/app-home-screen";

export const metadata: Metadata = {
  title: "NexusForge Command Center | Home",
  description: "NexusForge home dashboard for server, voice, and community command access.",
};

export default function AppPage() {
  return <AppHomeScreen />;
}
