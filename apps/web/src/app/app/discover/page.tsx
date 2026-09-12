import type { Metadata } from "next";
import { DiscoverPage } from "@/components/discover/discover-page";

export const metadata: Metadata = {
  title: "Discover",
  description: "Find your people. Join the movement.",
};

export default function AppDiscoverPage() {
  return <DiscoverPage />;
}
