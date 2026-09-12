import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home/home-dashboard";

export const metadata: Metadata = {
  title: "Home",
  description: "Your forge at a glance: members online, events, activity and creators.",
};

export default function AppHomePage() {
  return <HomeDashboard />;
}
