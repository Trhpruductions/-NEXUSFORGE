"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { EmailAdmin } from "@/components/admin/email-admin";

// The page only decides what to show; the server checks the staff role on every request.
export default function AdminEmailPage() {
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
      <ExperienceShell eyebrow="Safety" title="Sign in to see email tools" subtitle="Only Nexus Forge staff can see delivery records and send test emails." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="The email tools are restricted to staff."
          loginHref="/login?redirect=/admin/email"
          registerHref="/register?redirect=/admin/email"
        />
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Reliability"
      title="Email delivery"
      subtitle="What the server sent, what the mail server accepted, and what providers reported back. Recipients are masked and error text is redacted."
      metrics={[]}
      actions={[{ label: "Admin", href: "/admin", tone: "ghost" }]}
      maxWidthClassName="max-w-6xl"
    >
      <EmailAdmin />
    </ExperienceShell>
  );
}
