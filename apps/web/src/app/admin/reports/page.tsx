"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { StaffReports } from "@/components/admin/staff-reports";

// The page only decides what to show; the server checks the role on every request.
export default function AdminReportsPage() {
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
      <ExperienceShell eyebrow="Safety" title="Sign in to review reports" subtitle="Only Nexus Forge staff can open this page." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="Reviewing reports is restricted to staff."
          loginHref="/login?redirect=/admin/reports"
          registerHref="/register?redirect=/admin/reports"
        />
      </ExperienceShell>
    );
  }

  // Platform moderators work the report queue too.
  if (!user.isAdmin && user.appRole !== "MODERATOR") {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Staff only" subtitle="Only Nexus Forge staff and moderators can review reports." metrics={[]} actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">Report problems from a message’s flag button instead.</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Safety" title="Reported messages" subtitle="Direct-message reports land here. Server-channel reports are handled by each forge’s moderators, but staff can see them too." metrics={[]} actions={[{ label: "Admin", href: "/admin", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
      <StaffReports />
    </ExperienceShell>
  );
}
