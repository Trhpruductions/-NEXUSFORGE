"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { UpdatesAdmin } from "@/components/admin/updates-admin";

// The page only decides what to show; the server checks the role on every request.
export default function AdminUpdatesPage() {
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <ExperienceShell eyebrow="Access Check" title="Checking your access" subtitle="One moment." metrics={[]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-400">Loading...</div>
      </ExperienceShell>
    );
  }

  if (!user) {
    return (
      <ExperienceShell eyebrow="Safety" title="Sign in to write updates" subtitle="Only Nexus Forge staff can publish updates." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="Publishing updates is restricted to staff."
          loginHref="/login?redirect=/admin/updates"
          registerHref="/register?redirect=/admin/updates"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Staff only" subtitle="Only Nexus Forge staff can publish updates." metrics={[]} actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">See the latest updates on the What&apos;s new page instead.</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Announcements" title="What's new" subtitle="Write release notes. Publishing pops them up for everyone using Nexus Forge." metrics={[]} actions={[{ label: "Admin", href: "/admin", tone: "ghost" }, { label: "View page", href: "/app/updates", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
      <UpdatesAdmin />
    </ExperienceShell>
  );
}
