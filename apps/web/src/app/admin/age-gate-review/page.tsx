"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { AgeGateReviewPanel } from "@/components/admin/age-gate-review-panel";

export default function AdminAgeGateReviewPage() {
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;

    if (user && !user.isAdmin) {
      // Render access denied state instead of redirecting.
    }
  }, [user, hydrated]);

  if (!hydrated) {
    return (
      <ExperienceShell
        eyebrow="Access Check"
        title="Verifying admin credentials"
        subtitle="Waiting for your authentication state to resolve."
        metrics={[]}
        maxWidthClassName="max-w-5xl"
      >
        <div className="nexus-display-panel rounded-none p-5 text-slate-200">Loading authentication status...</div>
      </ExperienceShell>
    );
  }

  if (!user) {
    return (
      <ExperienceShell
        eyebrow="Admin Authentication"
        title="Sign in to access review tools"
        subtitle="This admin console is only available to authenticated administrators."
        metrics={[]}
        maxWidthClassName="max-w-5xl"
      >
        <GuestAuthCallout
          title="Admin review requires signing in."
          description="Authenticate with your admin account to inspect flagged age gate requests."
          loginHref="/login?redirect=/admin/age-gate-review"
          registerHref="/register?redirect=/admin/age-gate-review"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell
        eyebrow="Access Denied"
        title="Admin Only"
        subtitle="You do not have permission to access this review console."
        metrics={[]}
        actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]}
        maxWidthClassName="max-w-5xl"
      >
        <div className="nexus-display-panel rounded-none p-5 text-sm text-slate-300">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Restricted Access</p>
          <p className="mt-2">This page is reserved for administrator review workflows.</p>
        </div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Age Gate Review"
      title="Manual Verification Console"
      subtitle="Inspect and adjudicate flagged age verification requests in a separate admin workflow."
      metrics={[]}
      actions={[
        { label: "Admin Dashboard", href: "/admin", tone: "ghost" },
        { label: "Open App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <AgeGateReviewPanel />
    </ExperienceShell>
  );
}
