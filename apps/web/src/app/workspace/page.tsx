"use client";

import { useEffect, useMemo, useState } from "react";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { useAuthStore } from "@/store/auth-store";

const AUTH_PERSIST_MODE_KEY = "nexusforge-auth-persist-mode";

function formatDateLabel(value?: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function WorkspaceAnalyticsCards({
  roleLabel,
  sessionMode,
  emailVerified,
  premiumTier,
  joinedAt,
  lastSeenAt,
}: {
  roleLabel: string;
  sessionMode: string;
  emailVerified: boolean;
  premiumTier: string;
  joinedAt: string;
  lastSeenAt: string;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Role & Session</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Role:</span> {roleLabel}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Session Mode:</span> {sessionMode}
          </p>
        </div>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Account Readiness</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Email:</span> {emailVerified ? "Verified" : "Unverified"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Premium:</span> {premiumTier}
          </p>
        </div>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 sm:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Timeline</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Joined:</span> {joinedAt}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Last Seen:</span> {lastSeenAt}
          </p>
        </div>
      </section>
    </div>
  );
}

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
  const [sessionMode, setSessionMode] = useState("local");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mode = window.localStorage.getItem(AUTH_PERSIST_MODE_KEY);
    if (mode === "local" || mode === "session") {
      setSessionMode(mode);
    }
  }, []);

  const roleLabel = useMemo(() => {
    if (!user) return "Guest";
    if (user.appRole) return user.appRole;
    return user.isAdmin ? "ADMIN" : "USER";
  }, [user]);

  const premiumLabel = useMemo(() => {
    if (!user) return "None";
    if (user.premiumTier && user.premiumTier !== "NONE") return user.premiumTier;
    return user.premium ? "ACTIVE" : "NONE";
  }, [user]);

  const isGuest = hydrated && !user;
  const isReady = hydrated;
  const currentUser = user ?? null;

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
      ) : currentUser?.isAdmin ? (
        <>
          <WorkspaceAnalyticsCards
            roleLabel={roleLabel}
            sessionMode={sessionMode}
            emailVerified={Boolean(currentUser.emailVerified)}
            premiumTier={premiumLabel}
            joinedAt={formatDateLabel(currentUser.createdAt)}
            lastSeenAt={formatDateLabel(currentUser.lastSeenAt)}
          />
          <WorkspaceAdminView />
        </>
      ) : (
        <>
          <WorkspaceAnalyticsCards
            roleLabel={roleLabel}
            sessionMode={sessionMode}
            emailVerified={Boolean(currentUser?.emailVerified)}
            premiumTier={premiumLabel}
            joinedAt={formatDateLabel(currentUser?.createdAt)}
            lastSeenAt={formatDateLabel(currentUser?.lastSeenAt)}
          />
          <WorkspaceUserView />
        </>
      )}
    </ExperienceShell>
  );
}
