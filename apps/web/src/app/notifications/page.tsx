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
      <div className="nexus-display-panel mb-5 rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Priority filter</p>
            <p className="mt-2 text-sm text-slate-300">Use focus mode to surface mission-critical alerts and mute less urgent chatter.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="nexus-glow-button rounded-2xl px-4 py-2 text-xs font-semibold">Focus mode</button>
            <button className="nexus-outline-button rounded-2xl px-4 py-2 text-xs font-semibold">Mark all read</button>
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="nexus-metric-card rounded-2xl p-5 text-sm text-slate-400">Loading notifications...</div>}>
        <NotificationCenter />
      </Suspense>
    </ExperienceShell>
  );
}
