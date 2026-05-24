import { NotificationWorkspace } from "@/components/notifications/notification-workspace";
import { NotificationPageHeader } from "@/components/notifications/notification-page-header";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function NotificationsPage() {
  return (
    <ExperienceShell
      eyebrow="Signal Center"
      title="Notifications Workspace"
      subtitle="Track live updates, clear noise fast, and keep your operational feed under control."
      metrics={[
        { label: "Feed Mode", value: "Live", tone: "amber" },
        { label: "Alert Scope", value: "All Channels", tone: "amber" },
        { label: "Review Style", value: "Realtime", tone: "amber" },
      ]}
      actions={[
        { label: "Back to App", href: "/app", tone: "ghost" },
        { label: "Search Players", href: "/search", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <NotificationPageHeader
        title="Notifications Workspace"
        subtitle="Track live updates, clear noise fast, and keep your operational feed under control."
        description="Use focus mode to surface mission-critical alerts and mute less urgent chatter."
        badgeLabel="Priority filter"
        badgeValue="Live feed active"
        heroImages={["app-notifications-desktop.jpg"]}
      />
      <NotificationWorkspace
        panelLabel="Notification filters"
        panelDescription="Switch between urgent activity and unread alerts without leaving the page."
        filterLinks={[
          { label: "Focus activity", href: "/notifications?filter=activity", variant: "glow" },
          { label: "Show unread", href: "/notifications?filter=unread", variant: "outline" },
        ]}
      />
    </ExperienceShell>
  );
}
