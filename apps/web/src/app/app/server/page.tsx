import type { Metadata } from "next";
import { CommunityPage } from "@/components/community/community-page";

export const metadata: Metadata = {
  title: "Community",
  description: "Your forges, in one place.",
};

export default function AppServerPage() {
  return <CommunityPage />;
}
