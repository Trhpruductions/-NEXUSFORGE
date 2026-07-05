"use client";

import { useEffect, useMemo, useState } from "react";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { useAuthStore } from "@/store/auth-store";

const AUTH_PERSIST_MODE_KEY = "nexusforge-auth-persist-mode";
const HEALTH_REFRESH_INTERVAL_MS = 30_000;
const HEALTH_STALE_AFTER_MS = HEALTH_REFRESH_INTERVAL_MS * 3;

function formatDateLabel(value?: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type WorkspaceHealthStatus = "healthy" | "degraded" | "unknown";

type GateHealthResponse = {
  status: WorkspaceHealthStatus;
  detail?: string;
  generatedAt?: string | null;
  strictMode?: boolean;
  checkpointRequested?: boolean;
  checkpointSaved?: boolean;
  checkpointSkipped?: boolean;
  checkpointSkipReason?: string;
  counts?: {
    total: number;
    pass: number;
    warning: number;
    fail: number;
    error: number;
    blocking: number;
  };
};

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
  const [healthStatus, setHealthStatus] = useState<WorkspaceHealthStatus>("unknown");
  const [healthDetailsOpen, setHealthDetailsOpen] = useState(false);
  const [gateHealth, setGateHealth] = useState<GateHealthResponse | null>(null);
  const [isHealthRefreshing, setIsHealthRefreshing] = useState(false);
  const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mode = window.localStorage.getItem(AUTH_PERSIST_MODE_KEY);
    if (mode === "local" || mode === "session") {
      setSessionMode(mode);
    }
  }, []);

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setNowEpochMs(Date.now());
    }, 5_000);

    return () => {
      window.clearInterval(tickId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let activeController: AbortController | null = null;

    async function loadGateHealth() {
      if (requestInFlight) return;
      requestInFlight = true;
      setIsHealthRefreshing(true);

      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch("/api/ops/stability-gate", { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (active) {
            setGateHealth(null);
            setHealthStatus("unknown");
            setLastHealthCheckedAt(new Date().toISOString());
          }
          return;
        }

        const payload = (await response.json()) as GateHealthResponse;
        if (active) {
          setGateHealth(payload);
          if (payload.status === "healthy" || payload.status === "degraded") {
            setHealthStatus(payload.status);
          } else {
            setHealthStatus("unknown");
          }
          setLastHealthCheckedAt(new Date().toISOString());
        }
      } catch {
        if (active) {
          setGateHealth(null);
          setHealthStatus("unknown");
          setLastHealthCheckedAt(new Date().toISOString());
        }
      } finally {
        if (activeController === controller) {
          activeController = null;
        }
        requestInFlight = false;
        if (active) {
          setIsHealthRefreshing(false);
        }
      }
    }

    void loadGateHealth();
    const intervalId = window.setInterval(() => {
      void loadGateHealth();
    }, HEALTH_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (activeController) {
        activeController.abort();
      }
    };
  }, [refreshTrigger]);

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

  const lastCheckedAgeMs = useMemo(() => {
    if (!lastHealthCheckedAt) return null;
    const parsed = new Date(lastHealthCheckedAt).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, nowEpochMs - parsed);
  }, [lastHealthCheckedAt, nowEpochMs]);

  const isHealthStale = useMemo(() => {
    if (lastCheckedAgeMs == null) return false;
    return lastCheckedAgeMs > HEALTH_STALE_AFTER_MS;
  }, [lastCheckedAgeMs]);

  const healthMetric = useMemo(() => {
    if (isHealthStale) {
      return { value: "Stale", tone: "amber" as const };
    }

    if (healthStatus === "healthy") {
      return { value: "Healthy", tone: "emerald" as const };
    }

    if (healthStatus === "degraded") {
      return { value: "Degraded", tone: "amber" as const };
    }

    return { value: "Unknown", tone: "slate" as const };
  }, [healthStatus, isHealthStale]);

  const healthBadgeClass = useMemo(() => {
    if (isHealthStale) return "text-amber-700 border-amber-300/60 bg-amber-50";
    if (healthStatus === "healthy") return "text-emerald-700 border-emerald-300/60 bg-emerald-50";
    if (healthStatus === "degraded") return "text-amber-700 border-amber-300/60 bg-amber-50";
    return "text-slate-600 border-slate-300/60 bg-slate-100";
  }, [healthStatus, isHealthStale]);

  const generatedAtLabel = useMemo(() => {
    if (!gateHealth?.generatedAt) return "Unavailable";
    const parsed = new Date(gateHealth.generatedAt);
    if (Number.isNaN(parsed.getTime())) return "Unavailable";
    return parsed.toLocaleString();
  }, [gateHealth?.generatedAt]);

  const lastCheckedLabel = useMemo(() => {
    if (!lastHealthCheckedAt) return "Pending";
    const parsed = new Date(lastHealthCheckedAt);
    if (Number.isNaN(parsed.getTime())) return "Pending";
    return parsed.toLocaleString();
  }, [lastHealthCheckedAt]);

  const freshnessLabel = useMemo(() => {
    if (isHealthRefreshing) return "Refreshing";
    if (lastCheckedAgeMs == null) return "Pending";
    if (lastCheckedAgeMs > HEALTH_STALE_AFTER_MS) return "Stale";
    if (lastCheckedAgeMs > HEALTH_REFRESH_INTERVAL_MS) return "Aging";
    return "Fresh";
  }, [isHealthRefreshing, lastCheckedAgeMs]);

  const nextRefreshCountdownLabel = useMemo(() => {
    if (isHealthRefreshing) return "Refreshing now";
    if (lastCheckedAgeMs == null) return "Awaiting first sync";
    const remainingMs = Math.max(0, HEALTH_REFRESH_INTERVAL_MS - lastCheckedAgeMs);
    const seconds = Math.ceil(remainingMs / 1000);
    return `${seconds}s`;
  }, [isHealthRefreshing, lastCheckedAgeMs]);

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
        { label: "Runtime Health", value: healthMetric.value, tone: healthMetric.tone },
      ]}
      actions={[
        { label: user?.isAdmin ? "Open Admin Console" : "Open App Home", href: user?.isAdmin ? "/admin" : "/app", tone: "primary" },
        { label: "Mining", href: "/app/mining", tone: "ghost" },
        { label: "Notifications", href: "/notifications", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <div className="mb-4 nexus-display-panel rounded-[24px] p-4 text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Runtime Health</p>
            <p className="mt-1 text-sm text-slate-700">Inspect live gate results without leaving workspace.</p>
            <p className="mt-1 text-xs text-slate-500">Last checked: {lastCheckedLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Freshness: {freshnessLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Next refresh in: {nextRefreshCountdownLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTrigger((value) => value + 1)}
              disabled={isHealthRefreshing}
              className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isHealthRefreshing ? "Refreshing" : "Refresh Now"}
            </button>
            <button
              type="button"
              onClick={() => setHealthDetailsOpen((current) => !current)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${healthBadgeClass}`}
            >
              {healthMetric.value} · {healthDetailsOpen ? "Hide" : "Show"} Details
            </button>
          </div>
        </div>

        {healthDetailsOpen ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Generated</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{generatedAtLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Strict Mode</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.strictMode ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Pass / Total</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {gateHealth?.counts ? `${gateHealth.counts.pass}/${gateHealth.counts.total}` : "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Blocking Issues</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.counts ? String(gateHealth.counts.blocking) : "Unavailable"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Warnings</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.counts ? String(gateHealth.counts.warning) : "Unavailable"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Failures + Errors</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {gateHealth?.counts ? String(gateHealth.counts.fail + gateHealth.counts.error) : "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Checkpoint Action</p>
              <p className="mt-2 text-sm text-slate-700">
                {gateHealth?.checkpointRequested
                  ? gateHealth?.checkpointSaved
                    ? "Checkpoint saved"
                    : gateHealth?.checkpointSkipped
                      ? `Checkpoint skipped (${gateHealth.checkpointSkipReason ?? "unknown-reason"})`
                      : "Checkpoint requested"
                  : "No checkpoint requested in this run"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Gate Detail</p>
              <p className="mt-2 text-sm text-slate-700">{gateHealth?.detail ?? "No additional detail"}</p>
            </div>
          </div>
        ) : null}
      </div>

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
