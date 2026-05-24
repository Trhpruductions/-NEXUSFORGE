import type { Metadata } from "next";
import { NotificationPageHeader } from "@/components/notifications/notification-page-header";
import { NotificationWorkspace } from "@/components/notifications/notification-workspace";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Notifications",
  description: "Review notifications, alerts, and event updates.",
};

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <NotificationPageHeader
        title="Alert center"
        subtitle="Stay on top of live invites, event updates, and community listening notifications with your custom command view."
        description="Stay on top of invites, updates, and mission-critical alerts across your Forge ecosystem."
        badgeLabel="Notifications"
        badgeValue="Live feed active"
        heroImages={["app-notifications-desktop.jpg"]}
      />

      <NotificationWorkspace
        panelLabel="Priority filter"
        panelDescription="Use focus mode to surface mission-critical alerts and mute less urgent chatter."
        filterLinks={[
          { label: "Focus activity", href: "/app/notifications?filter=activity", variant: "glow" },
          { label: "Show unread", href: "/app/notifications?filter=unread", variant: "outline" },
        ]}
      />
    </div>
  );
}
