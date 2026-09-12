import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your story, your stats, your community.",
};

export default function AppProfilePage() {
  return <ProfilePage />;
}
