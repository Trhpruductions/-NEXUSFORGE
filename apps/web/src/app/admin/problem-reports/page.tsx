"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { ProblemReportsAdmin } from "@/components/admin/problem-reports-admin";

// The page only decides what to show; the server checks the role on every request.
export default function AdminProblemReportsPage() {
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
      <ExperienceShell eyebrow="Safety" title="Sign in to see problem reports" subtitle="Only Nexus Forge staff can see problem reports." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="Problem reports are restricted to staff."
          loginHref="/login?redirect=/admin/problem-reports"
          registerHref="/register?redirect=/admin/problem-reports"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Staff only" subtitle="Only Nexus Forge staff can see problem reports." metrics={[]} actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">If something is broken for you, tell us on the Support page.</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Support" title="Problem reports" subtitle="Sent from the Report a problem form on the website, newest first." metrics={[]} actions={[{ label: "Admin", href: "/admin", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
      <ProblemReportsAdmin />
    </ExperienceShell>
  );
}
