"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { getAdminAgeGateAudit } from "@/lib/api";

function RegularUserAccessView() {
  return (
    <ExperienceShell
      eyebrow="Regular User Workspace"
      title="This Area Is Built For Admin Operations"
      subtitle="Your account is fully active for community, mining, rewards, and profile features. Admin governance tools remain restricted to administrator roles."
      metrics={[
        { label: "Access", value: "User Workspace", tone: "emerald" },
        { label: "Admin Console", value: "Restricted", tone: "amber" },
        { label: "Recommended", value: "Go to /workspace", tone: "cyan" },
      ]}
      actions={[
        { label: "Open Workspace Hub", href: "/workspace", tone: "primary" },
        { label: "Notifications", href: "/notifications", tone: "ghost" },
        { label: "Profile", href: "/app/profile", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">What You Can Access</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Live activity feed, friends, and voice collaboration</li>
            <li>Mining, rewards, and crypto progression systems</li>
            <li>Personal profile and notification controls</li>
          </ul>
        </section>

        <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Why This Page Is Restricted</p>
          <p className="mt-3 text-sm text-slate-700">
            The admin console controls launch governance, moderation, and age-gate review workflows. These operations require elevated trust and are isolated from standard user journeys.
          </p>
        </section>

        <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 md:col-span-2 xl:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Need Elevated Access?</p>
          <p className="mt-3 text-sm text-slate-700">
            If you believe you need admin capabilities, contact a current administrator and request role verification through the normal governance path.
          </p>
        </section>
      </div>
    </ExperienceShell>
  );
}

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
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-600">Loading authentication status...</div>
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
    return <RegularUserAccessView />;
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
        { label: "Open Workspace", href: "/app", tone: "ghost" },
        { label: `Age Gate Review${pendingAgeGateCount > 0 ? ` (${pendingAgeGateCount})` : ""}` , href: "/admin/age-gate-review", tone: "primary" },
        { label: "Review Notifications", href: "/notifications", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <AdminDashboard />
    </ExperienceShell>
  );
}
