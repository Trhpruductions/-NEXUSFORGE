import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Mentions, friend requests, messages and system alerts.",
};

export default function AppNotificationsPage() {
  return <NotificationsPage />;
}
