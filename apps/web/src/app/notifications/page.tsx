import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function NotificationsPage() {
  return (
    <ExperienceShell
      eyebrow="Signal Center"
      title="Notifications Workspace"
      subtitle="Track live updates, clear noise fast, and keep your operational feed under control."
      metrics={[
        { label: "Feed Mode", value: "Live", tone: "emerald" },
        { label: "Alert Scope", value: "All Channels", tone: "cyan" },
        { label: "Review Style", value: "Realtime", tone: "amber" },
      ]}
      actions={[
        { label: "Back to App", href: "/app", tone: "ghost" },
        { label: "Search Players", href: "/search", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <Suspense fallback={<div className="nexus-metric-card rounded-2xl p-5 text-sm text-slate-400">Loading notifications...</div>}>
        <NotificationCenter />
      </Suspense>
    </ExperienceShell>
  );
}
