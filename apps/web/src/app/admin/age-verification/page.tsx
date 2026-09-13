"use client";

import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { AgeReviewQueue } from "@/components/admin/age-review-queue";

export default function AdminAgeVerificationPage() {
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <ExperienceShell eyebrow="Access Check" title="Verifying admin credentials" subtitle="Waiting for your authentication state to resolve." metrics={[]} maxWidthClassName="max-w-5xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-400">Loading authentication status...</div>
      </ExperienceShell>
    );
  }

  if (!user) {
    return (
      <ExperienceShell eyebrow="Admin Authentication" title="Sign in to review IDs" subtitle="Only administrators can open the ID review queue." metrics={[]} maxWidthClassName="max-w-5xl">
        <GuestAuthCallout
          title="Admin review requires signing in."
          description="Authenticate with your admin account to review age verification submissions."
          loginHref="/login?redirect=/admin/age-verification"
          registerHref="/register?redirect=/admin/age-verification"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell eyebrow="Access Denied" title="Admin Only" subtitle="You do not have permission to review identity documents." metrics={[]} actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]} maxWidthClassName="max-w-5xl">
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Restricted Access</p>
          <p className="mt-2">This page is reserved for administrators.</p>
        </div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Age Verification"
      title="ID Review Queue"
      subtitle="Approve or reject government ID submissions. Files are deleted the moment a decision is made."
      metrics={[]}
      actions={[
        { label: "Admin Dashboard", href: "/admin", tone: "ghost" },
        { label: "Open App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <AgeReviewQueue />
    </ExperienceShell>
  );
}
