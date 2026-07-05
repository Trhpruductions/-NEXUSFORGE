"use client";

import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { useAuthStore } from "@/store/auth-store";

function WorkspaceGuestView() {
  return (
    <GuestAuthCallout
      title="Sign in to unlock your workspace"
      description="NexusForge workspace gives regular users direct access to social coordination, mining systems, rewards, and profile controls."
      loginHref="/login?redirect=/workspace"
      registerHref="/register?redirect=/workspace"
      loginLabel="Sign in to Workspace"
      registerLabel="Create account"
    />
  );
}

function WorkspaceUserView() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Core Access</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Activity, friends, and voice collaboration</li>
          <li>Mining, rewards, and progression systems</li>
          <li>Profile management and notifications</li>
        </ul>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Recommended Flow</p>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Start in App Home for live feed context</li>
          <li>Open Mining or Rewards to continue progression</li>
          <li>Check Notifications for operational updates</li>
        </ol>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 md:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Admin Separation</p>
        <p className="mt-3 text-sm text-slate-700">
          Governance and moderation controls remain isolated under admin routes. This workspace is optimized for regular-user operations and progression.
        </p>
      </section>
    </div>
  );
}

function WorkspaceAdminView() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Admin Account Detected</p>
        <p className="mt-3 text-sm text-slate-700">
          You are signed in with administrative privileges. Workspace remains available, but governance tooling is best handled in the admin console.
        </p>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Recommended Action</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Open admin dashboard for launch governance</li>
          <li>Review age-gate and moderation queues</li>
          <li>Return to workspace for user-journey audits</li>
        </ul>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 md:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Operator Note</p>
        <p className="mt-3 text-sm text-slate-700">
          Keep policy and economy operations in admin surfaces to reduce accidental workflow crossover during live operations.
        </p>
      </section>
    </div>
  );
}

export default function WorkspacePage() {
  const { user, hydrated } = useAuthStore();

  const isGuest = hydrated && !user;
  const isReady = hydrated;

  return (
    <ExperienceShell
      eyebrow="Regular User Hub"
      title="Workspace Command Deck"
      subtitle="A focused control surface for regular users to coordinate, progress, and stay synced without admin overhead."
      metrics={[
        { label: "Audience", value: "Regular Users", tone: "emerald" },
        { label: "Admin Tools", value: "Separated", tone: "amber" },
        { label: "Workspace", value: "Operational", tone: "cyan" },
      ]}
      actions={[
        { label: user?.isAdmin ? "Open Admin Console" : "Open App Home", href: user?.isAdmin ? "/admin" : "/app", tone: "primary" },
        { label: "Mining", href: "/app/mining", tone: "ghost" },
        { label: "Notifications", href: "/notifications", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      {!isReady ? (
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-600">Loading workspace profile...</div>
      ) : isGuest ? (
        <WorkspaceGuestView />
      ) : user?.isAdmin ? (
        <WorkspaceAdminView />
      ) : (
        <WorkspaceUserView />
      )}
    </ExperienceShell>
  );
}
