"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { ErrorLogAdmin } from "@/components/admin/error-log-admin";

// The page only decides what to show; the server checks the role on every request.
export default function AdminErrorsPage() {
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
      <ExperienceShell eyebrow="Safety" title="Sign in to see the error log" subtitle="Only Vexora staff can see crashes and server errors." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="The error log is restricted to staff."
          loginHref="/login?redirect=/admin/errors"
          registerHref="/register?redirect=/admin/errors"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Staff only" subtitle="Only Vexora staff can see the error log." metrics={[]} actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">If something is broken for you, tell us on the Support page.</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Reliability" title="Error log" subtitle="Crashes in people's browsers and server errors, grouped so repeats count up instead of piling up." metrics={[]} actions={[{ label: "Admin", href: "/admin", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
      <ErrorLogAdmin />
    </ExperienceShell>
  );
}
