"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { getAdminAgeGateAudit } from "@/lib/api";

export default function AdminPage() {
  const { accessToken, csrfToken, user, hydrated } = useAuthStore();

  const ageGateReviewQuery = useQuery({
    queryKey: ["admin-age-gate-review-count", accessToken, csrfToken],
    queryFn: () =>
      getAdminAgeGateAudit(accessToken!, csrfToken!, {
        limit: 1,
        offset: 0,
        status: "blocked",
      }),
    enabled: Boolean(accessToken && csrfToken),
    staleTime: 30_000,
  });

  const pendingAgeGateCount = ageGateReviewQuery.data?.total ?? 0;

  useEffect(() => {
    if (!hydrated) return;

    if (user && !user.isAdmin) {
      // Keep the page rendering the restricted access view.
    }
  }, [user, hydrated]);

  if (!hydrated) {
    return (
      <ExperienceShell
        eyebrow="Access Check"
        title="Checking admin access"
        subtitle="Verifying authentication state before showing the moderation console."
        metrics={[
          { label: "Access", value: "Verifying", tone: "amber" },
          { label: "Role", value: "Pending", tone: "slate" },
        ]}
        maxWidthClassName="max-w-7xl"
      >
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-200">Loading authentication status...</div>
      </ExperienceShell>
    );
  }

  if (!user) {
    return (
      <ExperienceShell
        eyebrow="Admin Authentication"
        title="Sign in to access admin tools"
        subtitle="Administration is reserved for authenticated administrators."
        metrics={[
          { label: "Access", value: "Requires login", tone: "amber" },
          { label: "Role", value: "Admin", tone: "slate" },
        ]}
        maxWidthClassName="max-w-7xl"
      >
        <GuestAuthCallout
          title="Admin access requires signing in."
          description="Use your administrator account to access moderation, governance, and age gate review workflows."
          loginHref="/login?redirect=/admin"
          registerHref="/register?redirect=/admin"
        />
      </ExperienceShell>
    );
  }

  if (!user.isAdmin) {
    return (
      <ExperienceShell
        eyebrow="Access Denied"
        title="Admin Only"
        subtitle="You do not have permission to access moderation and governance controls."
        metrics={[
          { label: "Access", value: "Restricted", tone: "amber" },
          { label: "Required Role", value: "ADMIN", tone: "slate" },
        ]}
        actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]}
        maxWidthClassName="max-w-7xl"
      >
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-300">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Restricted Access</p>
          <p className="mt-2">Your current account lacks admin privileges.</p>
        </div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Moderation Console"
      title="Admin Dashboard"
      subtitle="Monitor growth, manage permissions, and enforce launch governance from one hardened control surface."
      metrics={[
        { label: "Governance", value: "Live", tone: "emerald" },
        { label: "Launch Mode", value: "Runtime Controlled", tone: "cyan" },
        { label: "Pending Reviews", value: String(pendingAgeGateCount), tone: pendingAgeGateCount > 0 ? "amber" : "emerald" },
      ]}
      actions={[
        { label: "Open Command Center", href: "/app", tone: "ghost" },
        { label: `Age Gate Review${pendingAgeGateCount > 0 ? ` (${pendingAgeGateCount})` : ""}` , href: "/admin/age-gate-review", tone: "primary" },
        { label: "Review Notifications", href: "/notifications", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <AdminDashboard />
    </ExperienceShell>
  );
}
