"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { LegalAdmin } from "@/components/admin/legal-admin";

// The page only decides what to show; the server checks the role on every request.
export default function AdminLegalPage() {
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
      <ExperienceShell eyebrow="Legal Administration" title="Sign in to manage legal documents" subtitle="Only legal administrators can open this page." metrics={[]} maxWidthClassName="max-w-6xl">
        <GuestAuthCallout
          title="Sign in with an administrator account."
          description="Drafting and publishing legal documents is restricted."
          loginHref="/login?redirect=/admin/legal"
          registerHref="/register?redirect=/admin/legal"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Administrators only" subtitle="You don't have permission to manage legal documents." metrics={[]} actions={[{ label: "Legal Center", href: "/legal", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">Read the published policies in the Legal Center instead.</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Legal Administration" title="Legal documents" subtitle="Draft, review, publish and keep the history of every policy." metrics={[]} actions={[{ label: "Legal Center", href: "/legal", tone: "ghost" }, { label: "Admin", href: "/admin", tone: "ghost" }]} maxWidthClassName="max-w-6xl">
      <LegalAdmin />
    </ExperienceShell>
  );
}
