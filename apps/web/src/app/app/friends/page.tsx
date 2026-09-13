import type { Metadata } from "next";
import { FriendsPage } from "@/components/friends/friends-page";

export const metadata: Metadata = {
  title: "Friends",
  description: "People you keep in reach.",
};

export default function AppFriendsPage() {
  return <FriendsPage />;
}
