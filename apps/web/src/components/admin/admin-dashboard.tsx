"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuthStore } from "@/store/auth-store";
import { api, authHeaders } from "@/lib/api";
import { adminAdjustReputation, adminGenerateSampleProfiles, adminResetGenerationLock, adminSeedMedals, getAdminAiInsights, getAdminLaunchMode, getAdminProfileAudit, getAdminProfileToolsStatus, getAdminRevenue, getBillingReadiness, setAdminLaunchMode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type AppRole = "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";
type ManualBadgeKey = "vip" | "staff" | "legend" | "founder" | "developer" | "moderator" | "admin" | "owner";

const manualBadgeOptions: Array<{ key: ManualBadgeKey; label: string }> = [
  { key: "vip", label: "VIP" },
  { key: "staff", label: "Staff" },
  { key: "legend", label: "Legend" },
  { key: "founder", label: "Founder" },
  { key: "developer", label: "Developer" },
  { key: "moderator", label: "Moderator" },
  { key: "admin", label: "Admin" },
  { key: "owner", label: "Owner" },
];

const billingEnvTemplate = [
  "STRIPE_SECRET_KEY=",
  "STRIPE_WEBHOOK_SECRET=",
  "STRIPE_PRICE_CORE_MONTHLY=",
  "STRIPE_PRICE_CORE_YEARLY=",
  "STRIPE_PRICE_PLUS_MONTHLY=",
  "STRIPE_PRICE_PLUS_YEARLY=",
  "STRIPE_PRICE_ELITE_MONTHLY=",
  "STRIPE_PRICE_ELITE_YEARLY=",
  "STRIPE_PRICE_INFINITE_MONTHLY=",
  "STRIPE_PRICE_INFINITE_YEARLY=",
  "STRIPE_PRICE_FORGE_BOOST_PACK=",
  "STRIPE_PRICE_CREATOR_CAMPAIGN_SLOT=",
  "STRIPE_PRICE_EVENT_TICKET_PASS=",
  "STRIPE_PRICE_TEAM_BRANDING_KIT=",
  "STRIPE_PRICE_ADVANCED_MODERATION_AI=",
].join("\n");

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function extractAdminErrorNote(error: unknown, fallback: string) {
  if (!isAxiosError(error)) {
    return fallback;
  }

  const status = error.response?.status;
  const payload = error.response?.data as
    | { error?: string; retryAfterSeconds?: number; retryAfterMs?: number }
    | undefined;

  if (status === 429 && payload?.retryAfterSeconds) {
    return `${payload.error ?? "Action is cooling down."} Retry in ${payload.retryAfterSeconds}s.`;
  }

  if (status === 503 && payload?.retryAfterSeconds) {
    return `${payload.error ?? "Temporary contention detected."} Retry in ${payload.retryAfterSeconds}s.`;
  }

  if (status === 409) {
    return payload?.error ?? "Another generation run is already active.";
  }

  return payload?.error ?? fallback;
}

export function AdminDashboard() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [reputationDelta, setReputationDelta] = useState<number>(25);
  const [actionNote, setActionNote] = useState<string>("");
  const [roleDraftByUser, setRoleDraftByUser] = useState<Record<string, AppRole>>({});
  const [badgeDraftByUser, setBadgeDraftByUser] = useState<Record<string, ManualBadgeKey>>({});
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "seed-medals" | "generate-sample-data" | "adjust-reputation">("all");
  const [auditActorFilter, setAuditActorFilter] = useState<string>("all");
  const [auditOffset, setAuditOffset] = useState<number>(0);
  const [desktopOnlyDraft, setDesktopOnlyDraft] = useState<boolean>(true);
  const [billingCopyState, setBillingCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const auditPageSize = 30;

  const summaryQuery = useQuery({
    queryKey: ["admin-summary", accessToken],
    queryFn: async () => {
      const response = await api.get<{ users: number; forges: number; messages: number; notifications: number; pendingFriends: number }>(
        "/api/admin/summary",
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    enabled: Boolean(accessToken && csrfToken),
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", accessToken],
    queryFn: async () => {
      const response = await api.get<{
        actorRole: AppRole;
        canManageHighRoles: boolean;
        users: Array<{ id: string; username: string; email: string; appRole: AppRole; isAdmin: boolean; premium: boolean; status: string; manualBadges?: ManualBadgeKey[] }>;
      }>(
        "/api/admin/users",
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    enabled: Boolean(accessToken && csrfToken),
  });

  const revenueQuery = useQuery({
    queryKey: ["admin-revenue", accessToken],
    queryFn: () => getAdminRevenue(accessToken!, csrfToken!),
    enabled: Boolean(accessToken && csrfToken),
  });

  const aiInsightsQuery = useQuery({
    queryKey: ["admin-ai-insights", accessToken],
    queryFn: () => getAdminAiInsights(accessToken!, csrfToken!),
    enabled: Boolean(accessToken && csrfToken),
    retry: false,
  });

  const profileAuditQuery = useQuery({
    queryKey: ["admin-profile-audit", accessToken, auditActionFilter, auditActorFilter, auditOffset],
    queryFn: () =>
      getAdminProfileAudit(accessToken!, csrfToken!, {
        limit: auditPageSize,
        offset: auditOffset,
        action: auditActionFilter === "all" ? undefined : auditActionFilter,
        actorId: auditActorFilter === "all" ? undefined : auditActorFilter,
      }),
    enabled: Boolean(accessToken && csrfToken),
  });

  const profileToolsStatusQuery = useQuery({
    queryKey: ["admin-profile-tools-status", accessToken],
    queryFn: () => getAdminProfileToolsStatus(accessToken!, csrfToken!),
    enabled: Boolean(accessToken && csrfToken),
    refetchInterval: 5000,
  });

  const launchModeQuery = useQuery({
    queryKey: ["admin-launch-mode", accessToken],
    queryFn: () => getAdminLaunchMode(accessToken!, csrfToken!),
    enabled: Boolean(accessToken && csrfToken),
  });

  const billingReadinessQuery = useQuery({
    queryKey: ["admin-billing-readiness"],
    queryFn: getBillingReadiness,
    enabled: Boolean(accessToken && csrfToken),
    staleTime: 30_000,
    retry: false,
  });

  const toggleAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post<{ user: { id: string; username: string; appRole: AppRole; isAdmin: boolean } }>(
        `/api/admin/users/${userId}/toggle-admin`,
        {},
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["admin-summary", accessToken] });
    },
  });

  const setUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const response = await api.post<{ user: { id: string; username: string; appRole: AppRole; isAdmin: boolean } }>(
        `/api/admin/users/${userId}/set-role`,
        { role },
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    onSuccess: async (data) => {
      setActionNote(`Role updated: ${data.user.username} is now ${data.user.appRole}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["admin-summary", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to update user role."));
    },
  });

  const grantManualBadge = useMutation({
    mutationFn: async ({ userId, badgeKey }: { userId: string; badgeKey: ManualBadgeKey }) => {
      const response = await api.post<{ user: { id: string; username: string }; badgeKey: ManualBadgeKey }>(
        `/api/admin/users/${userId}/badges/grant`,
        { badgeKey },
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    onSuccess: async (data) => {
      setActionNote(`Granted ${data.badgeKey.toUpperCase()} badge to ${data.user.username}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to grant manual profile badge."));
    },
  });

  const revokeManualBadge = useMutation({
    mutationFn: async ({ userId, badgeKey }: { userId: string; badgeKey: ManualBadgeKey }) => {
      const response = await api.post<{ user: { id: string; username: string }; badgeKey: ManualBadgeKey }>(
        `/api/admin/users/${userId}/badges/revoke`,
        { badgeKey },
        { headers: authHeaders(accessToken, csrfToken) },
      );
      return response.data;
    },
    onSuccess: async (data) => {
      setActionNote(`Revoked ${data.badgeKey.toUpperCase()} badge from ${data.user.username}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to revoke manual profile badge."));
    },
  });

  const seedMedals = useMutation({
    mutationFn: async () => adminSeedMedals(accessToken!, csrfToken!),
    onSuccess: (data) => {
      setActionNote(`Medal catalog synced: ${data.created} created, ${data.updated} updated.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-audit", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-tools-status", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to seed medal catalog."));
    },
  });

  const generateSampleProfiles = useMutation({
    mutationFn: async () =>
      adminGenerateSampleProfiles(accessToken!, csrfToken!, {
        userLimit: 30,
        activitiesPerUser: 6,
        minReputation: 120,
        maxReputation: 1300,
        awardRandomMedals: true,
      }),
    onSuccess: (data) => {
      setActionNote(
        `Sample data generated for ${data.usersProcessed} users with ${data.createdActivities} activities.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-audit", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-tools-status", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to generate sample profiles."));
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-tools-status", accessToken] });
    },
  });

  const adjustReputation = useMutation({
    mutationFn: async () =>
      adminAdjustReputation(accessToken!, csrfToken!, {
        userId: selectedUserId,
        delta: reputationDelta,
        reason: "Admin dashboard profile balancing",
      }),
    onSuccess: (data) => {
      setActionNote(`Reputation updated: ${data.user.username} is now ${data.user.reputation}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-users", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-audit", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to adjust user reputation."));
    },
  });

  const resetGenerationLock = useMutation({
    mutationFn: async () => adminResetGenerationLock(accessToken!, csrfToken!),
    onSuccess: (data) => {
      setActionNote(data.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-audit", accessToken] });
      void queryClient.invalidateQueries({ queryKey: ["admin-profile-tools-status", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to reset generation lock."));
    },
  });

  const setLaunchMode = useMutation({
    mutationFn: async () => setAdminLaunchMode(accessToken!, csrfToken!, desktopOnlyDraft),
    onSuccess: (data) => {
      setActionNote(`Launch mode updated: desktop-only is now ${data.desktopOnly ? "ENABLED" : "DISABLED"}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-launch-mode", accessToken] });
    },
    onError: (error) => {
      setActionNote(extractAdminErrorNote(error, "Failed to update launch mode."));
    },
  });

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.users?.length) {
      setSelectedUserId(usersQuery.data.users[0]!.id);
    }
  }, [selectedUserId, usersQuery.data?.users]);

  useEffect(() => {
    if (!usersQuery.data?.users?.length) {
      return;
    }

    setRoleDraftByUser((previous) => {
      const next: Record<string, AppRole> = { ...previous };
      for (const entry of usersQuery.data.users) {
        if (!next[entry.id]) {
          next[entry.id] = entry.appRole;
        }
      }
      return next;
    });
  }, [usersQuery.data?.users]);

  useEffect(() => {
    if (!usersQuery.data?.users?.length) {
      return;
    }

    setBadgeDraftByUser((previous) => {
      const next: Record<string, ManualBadgeKey> = { ...previous };
      for (const entry of usersQuery.data.users) {
        if (!next[entry.id]) {
          next[entry.id] = "vip";
        }
      }
      return next;
    });
  }, [usersQuery.data?.users]);

  useEffect(() => {
    setAuditOffset(0);
  }, [auditActionFilter, auditActorFilter]);

  useEffect(() => {
    if (typeof launchModeQuery.data?.desktopOnly === "boolean") {
      setDesktopOnlyDraft(launchModeQuery.data.desktopOnly);
    }
  }, [launchModeQuery.data?.desktopOnly]);

  useEffect(() => {
    const latestCompletedAt = profileToolsStatusQuery.data?.lastCompletedAt;
    const cooldownMs = profileToolsStatusQuery.data?.cooldownMs ?? 0;

    if (!latestCompletedAt || cooldownMs <= 0) {
      return;
    }

    const unlockAtMs = new Date(latestCompletedAt).getTime() + cooldownMs;
    if (unlockAtMs <= Date.now()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [profileToolsStatusQuery.data?.cooldownMs, profileToolsStatusQuery.data?.lastCompletedAt]);

  if (!accessToken || !csrfToken) {
    return (
      <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-300">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Authentication Required</p>
        <p className="mt-2">Sign in with an admin account to access moderation tools.</p>
      </div>
    );
  }

  const riskToneClass =
    aiInsightsQuery.data?.insights.riskLevel === "CRITICAL"
      ? "text-rose-200"
      : aiInsightsQuery.data?.insights.riskLevel === "HIGH"
        ? "text-amber-200"
        : aiInsightsQuery.data?.insights.riskLevel === "MEDIUM"
          ? "text-yellow-200"
          : "text-emerald-200";

  const latestCompletedAtMs = profileToolsStatusQuery.data?.lastCompletedAt
    ? new Date(profileToolsStatusQuery.data.lastCompletedAt).getTime()
    : null;
  const generationCooldownSeconds = latestCompletedAtMs
    ? Math.max(
        0,
        Math.ceil((latestCompletedAtMs + (profileToolsStatusQuery.data?.cooldownMs ?? 0) - nowMs) / 1000),
      )
    : 0;
  const generationBlockedByCooldown = generationCooldownSeconds > 0;
  const latestJobStatus = profileToolsStatusQuery.data?.latestJob?.metadata?.status;
  const latestJobResult = profileToolsStatusQuery.data?.latestJob?.metadata?.result;
  const latestJobError = profileToolsStatusQuery.data?.latestJob?.metadata?.errorMessage;
  const latestJobStatusToneClass =
    latestJobStatus === "FAILED"
      ? "border-rose-500/35 bg-rose-950/30 text-rose-100"
      : latestJobStatus === "RUNNING"
        ? "border-amber-500/35 bg-amber-950/30 text-amber-100"
        : "border-emerald-500/35 bg-emerald-950/30 text-emerald-100";
  const billing = billingReadinessQuery.data?.billing ?? null;
  const billingReady = billing?.ready ?? false;
  const missingTierPrices = billing?.missing.tierPrices ?? [];
  const missingAddOnPrices = billing?.missing.addOnPrices ?? [];
  const billingStatusToneClass = billingReady
    ? "border-emerald-500/35 bg-emerald-950/20 text-emerald-100"
    : "border-amber-500/35 bg-amber-950/20 text-amber-100";

  const copyBillingEnvKeys = async () => {
    try {
      await navigator.clipboard.writeText(billingEnvTemplate);
      setBillingCopyState("copied");
      setActionNote("Copied required Stripe env keys to clipboard.");
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
    } catch {
      setBillingCopyState("failed");
      setActionNote("Unable to copy env keys automatically. Copy them from apps/server/.env.example.");
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
    }
  };

  const copyMissingBillingEnvKeys = async () => {
    if (!billing) {
      setBillingCopyState("failed");
      setActionNote("Billing readiness has not loaded yet. Retry in a moment.");
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
      return;
    }

    const missingLines: string[] = [];
    if (!billing.configured.stripeSecretKey) {
      missingLines.push("STRIPE_SECRET_KEY=");
    }

    for (const entry of missingTierPrices) {
      missingLines.push(`STRIPE_PRICE_${entry}=`);
    }

    for (const entry of missingAddOnPrices) {
      missingLines.push(`STRIPE_PRICE_${entry}=`);
    }

    if (missingLines.length === 0) {
      setActionNote("No missing billing keys detected.");
      setBillingCopyState("copied");
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
      return;
    }

    try {
      await navigator.clipboard.writeText(missingLines.join("\n"));
      setBillingCopyState("copied");
      setActionNote(`Copied ${missingLines.length} missing billing keys to clipboard.`);
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
    } catch {
      setBillingCopyState("failed");
      setActionNote("Unable to copy missing billing keys automatically.");
      window.setTimeout(() => setBillingCopyState("idle"), 3000);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <section className="nexus-display-panel relative overflow-hidden rounded-[28px] p-5">
        <div className="nexus-ambient" aria-hidden="true">
          <div className="nexus-ambient-orb nexus-ambient-orb-a" />
          <div className="nexus-ambient-orb nexus-ambient-orb-b" />
        </div>
        <div className="relative">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Admin Summary</h2>
              <p className="mt-2 text-sm text-slate-400">Live governance telemetry, billing posture, and launch-control state for the desktop command surface.</p>
            </div>
            <div className="rounded-full border border-cyan-500/30 bg-cyan-950/25 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
              Hardened
            </div>
          </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Users: {summaryQuery.data?.users ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Forges: {summaryQuery.data?.forges ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Messages: {summaryQuery.data?.messages ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Notifications: {summaryQuery.data?.notifications ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Pending Friend Requests: {summaryQuery.data?.pendingFriends ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">Active Subscriptions: {revenueQuery.data?.revenue.activeSubscriptions ?? 0}</div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-200">
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">
            Revenue 30d: <span className="font-semibold text-emerald-200">{formatUsd(revenueQuery.data?.revenue.last30DaysCents ?? 0)}</span>
          </div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">
            Revenue Growth: <span className="font-semibold text-cyan-200">{revenueQuery.data?.revenue.growthPct ?? 0}%</span>
          </div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3">
            Failed Payments (30d): <span className="font-semibold text-rose-200">{revenueQuery.data?.revenue.failedPayments ?? 0}</span>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-100">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Launch Control</p>
          <p className="mt-1 text-slate-300">
            Runtime launch gate currently <span className="font-semibold text-amber-100">{launchModeQuery.data?.desktopOnly ? "DESKTOP ONLY" : "EXPANDED ACCESS ENABLED"}</span>.
          </p>
          <p className="mt-1 text-slate-400">
            Source: {launchModeQuery.data?.source ?? "-"}
            {launchModeQuery.data?.updatedBy ? ` • Updated by ${launchModeQuery.data.updatedBy.username}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className={`h-8 px-3 text-xs ${desktopOnlyDraft ? "border border-cyan-500/35 bg-cyan-950/25 text-cyan-100" : ""}`}
              onClick={() => setDesktopOnlyDraft(true)}
            >
              Desktop Only
            </Button>
            <Button
              variant="ghost"
              className={`h-8 px-3 text-xs ${!desktopOnlyDraft ? "border border-emerald-500/35 bg-emerald-950/25 text-emerald-100" : ""}`}
              onClick={() => setDesktopOnlyDraft(false)}
            >
              Enable Web Access
            </Button>
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs"
              onClick={() => setLaunchMode.mutate()}
              disabled={setLaunchMode.isPending || launchModeQuery.isLoading}
            >
              {setLaunchMode.isPending ? "Applying..." : "Apply Launch Mode"}
            </Button>
          </div>
        </div>

        <div className={`mt-4 rounded-[24px] border p-4 text-xs ${billingStatusToneClass}`}>
          <p className="text-[10px] uppercase tracking-[0.2em]">Billing Setup</p>
          {billingReadinessQuery.isLoading ? (
            <p className="mt-1 text-slate-300">Checking billing readiness...</p>
          ) : billingReady ? (
            <p className="mt-1 text-emerald-100">Billing is ready. Checkout and portal actions are fully enabled.</p>
          ) : (
            <>
              <p className="mt-1 text-slate-300">
                Billing is in setup mode. Missing tier prices: <span className="font-semibold">{missingTierPrices.length}</span>; missing add-on prices: <span className="font-semibold">{missingAddOnPrices.length}</span>.
              </p>
              <div className="mt-2 space-y-1 text-[11px] text-amber-200/90">
                {!billing?.configured.stripeSecretKey ? <p>Missing STRIPE_SECRET_KEY</p> : null}
                {missingTierPrices.length ? <p>Missing tier IDs: {missingTierPrices.slice(0, 4).join(", ")}{missingTierPrices.length > 4 ? "..." : ""}</p> : null}
                {missingAddOnPrices.length ? <p>Missing add-on IDs: {missingAddOnPrices.join(", ")}</p> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => void copyBillingEnvKeys()}>
                  Copy Required Env Keys
                </Button>
                <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => void copyMissingBillingEnvKeys()}>
                  Copy Missing Keys Only
                </Button>
                {billingCopyState === "copied" ? <p className="text-[11px] text-emerald-200">Copied</p> : null}
                {billingCopyState === "failed" ? <p className="text-[11px] text-rose-200">Copy failed</p> : null}
              </div>
            </>
          )}
        </div>
        </div>
      </section>

      <section className="nexus-panel rounded-[28px] p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Moderation Queue</h2>
            <p className="mt-2 text-sm text-slate-400">Role escalation, access correction, and admin privilege changes in one queue.</p>
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {usersQuery.data?.users.length ?? 0} users
          </div>
        </div>
        <div className="space-y-2">
          {usersQuery.data?.users.map((entry) => (
            <div key={entry.id} className="nexus-interactive-card flex flex-col items-stretch gap-3 rounded-[24px] border border-slate-800 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.16))] px-4 py-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span>{entry.username}</span>
                  <span className="rounded-full border border-cyan-500/35 bg-cyan-950/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                    {entry.appRole}
                  </span>
                </p>
                <p className="text-xs text-slate-400">{entry.email}</p>
                              {(entry.manualBadges?.length ?? 0) > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {entry.manualBadges!.map((badgeKey) => (
                                    <span
                                      key={`${entry.id}-badge-${badgeKey}`}
                                      className="rounded-full border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100"
                                    >
                                      {badgeKey}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                <select
                  value={roleDraftByUser[entry.id] ?? entry.appRole}
                  onChange={(event) =>
                    setRoleDraftByUser((previous) => ({
                      ...previous,
                      [entry.id]: event.target.value as AppRole,
                    }))
                  }
                  className="h-9 min-w-0 rounded-lg border border-slate-600/80 bg-slate-950/80 px-2 text-xs text-slate-100 sm:min-w-[140px]"
                  aria-label={`Select role for ${entry.username}`}
                >
                  <option value="USER">USER</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="EXEC" disabled={!usersQuery.data?.canManageHighRoles}>EXEC</option>
                  <option value="OWNER" disabled={!usersQuery.data?.canManageHighRoles}>OWNER</option>
                </select>
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-xs nexus-interactive-btn"
                  onClick={() =>
                    setUserRole.mutate({
                      userId: entry.id,
                      role: roleDraftByUser[entry.id] ?? entry.appRole,
                    })
                  }
                  disabled={setUserRole.isPending}
                >
                  Apply Role
                </Button>
                <Button variant="ghost" className="h-9 px-3 text-xs nexus-interactive-btn" onClick={() => toggleAdmin.mutate(entry.id)}>
                  {entry.isAdmin ? "Quick Demote" : "Quick Promote"}
                </Button>
                <select
                  value={badgeDraftByUser[entry.id] ?? "vip"}
                  onChange={(event) =>
                    setBadgeDraftByUser((previous) => ({
                      ...previous,
                      [entry.id]: event.target.value as ManualBadgeKey,
                    }))
                  }
                  className="h-9 min-w-0 rounded-lg border border-slate-600/80 bg-slate-950/80 px-2 text-xs text-slate-100 sm:min-w-[128px]"
                  aria-label={`Select badge for ${entry.username}`}
                >
                  {manualBadgeOptions.map((option) => (
                    <option key={`${entry.id}-badge-option-${option.key}`} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-xs nexus-interactive-btn"
                  onClick={() =>
                    grantManualBadge.mutate({
                      userId: entry.id,
                      badgeKey: badgeDraftByUser[entry.id] ?? "vip",
                    })
                  }
                  disabled={grantManualBadge.isPending}
                >
                  Grant Badge
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-xs nexus-interactive-btn"
                  onClick={() =>
                    revokeManualBadge.mutate({
                      userId: entry.id,
                      badgeKey: badgeDraftByUser[entry.id] ?? "vip",
                    })
                  }
                  disabled={revokeManualBadge.isPending}
                >
                  Revoke Badge
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="nexus-panel rounded-[28px] p-5 lg:col-span-2">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Billing Mix (Last 30 Days)</h2>
            <p className="mt-2 text-sm text-slate-400">Revenue concentration, transaction density, and tier-distribution health.</p>
          </div>
          <div className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
            Finance live
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700/70 text-slate-300">
                <th className="py-2 pr-3">Feature</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {(revenueQuery.data?.featureRevenue ?? []).map((row) => (
                <tr key={row.featureCode} className="border-b border-slate-800/70 text-slate-200 transition-colors hover:bg-slate-900/45">
                  <td className="py-2 pr-3 font-medium text-slate-100">{row.featureCode}</td>
                  <td className="py-2 pr-3 text-emerald-200">{formatUsd(row.revenueCents)}</td>
                  <td className="py-2">{row.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3 text-sm text-slate-200">CORE: {revenueQuery.data?.tierDistribution.CORE ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3 text-sm text-slate-200">PLUS: {revenueQuery.data?.tierDistribution.PLUS ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3 text-sm text-slate-200">ELITE: {revenueQuery.data?.tierDistribution.ELITE ?? 0}</div>
          <div className="glass-cut rounded-xl border border-slate-800/80 p-3 text-sm text-slate-200">INFINITE: {revenueQuery.data?.tierDistribution.INFINITE ?? 0}</div>
        </div>
      </section>

      <section className="nexus-panel rounded-[28px] p-5 lg:col-span-2">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Advanced Moderation AI</h2>
            <p className="mt-2 text-sm text-slate-400">Pressure scoring, automation posture, and recommended response playbooks.</p>
          </div>
          <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${latestJobStatusToneClass}`}>
            Risk engine
          </div>
        </div>
        {aiInsightsQuery.isError ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 text-sm text-amber-100">
            Advanced moderation intelligence is payment-gated. Unlock it from the <Link href="/pricing" className="font-semibold underline">pricing center</Link>.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="glass-cut rounded-xl border border-slate-800/80 p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Pressure Score</p>
              <p className="mt-2 text-3xl font-semibold text-rose-200">{aiInsightsQuery.data?.insights.pressureScore ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl border border-slate-800/80 p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent Messages</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-100">{aiInsightsQuery.data?.insights.recentMessages ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl border border-slate-800/80 p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">New Accounts 7d</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-100">{aiInsightsQuery.data?.insights.recentAccounts ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl border border-slate-800/80 p-4 text-slate-200 md:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Risk Level</p>
                  <p className={`mt-2 text-2xl font-semibold ${riskToneClass}`}>{aiInsightsQuery.data?.insights.riskLevel ?? "LOW"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Incident Likelihood</p>
                  <p className="mt-2 text-2xl font-semibold text-cyan-100">{aiInsightsQuery.data?.insights.incidentLikelihoodPct ?? 0}%</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 text-sm text-slate-200">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Automation Actions</p>
              <div className="grid gap-2 md:grid-cols-3">
                {(aiInsightsQuery.data?.insights.automationActions ?? []).map((action) => (
                  <div key={action} className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                    {action}
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 text-sm text-slate-200">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Recommended Playbooks</p>
              <div className="grid gap-2 md:grid-cols-3">
                {(aiInsightsQuery.data?.insights.recommendedPlaybooks ?? []).map((playbook) => (
                  <div key={playbook.title} className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">{playbook.title}</p>
                    <p className="mt-1 text-[11px] text-slate-300">{playbook.detail}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">Priority: {playbook.priority}</p>
                  </div>
                ))}
              </div>
            </div>
            {(aiInsightsQuery.data?.insights.bottlenecks.length ?? 0) > 0 ? (
              <div className="md:col-span-3 rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 text-sm text-amber-100">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-amber-200">Detected Bottlenecks</p>
                <div className="grid gap-2">
                  {aiInsightsQuery.data?.insights.bottlenecks.map((item) => (
                    <div key={item} className="rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2 text-[12px]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="nexus-panel rounded-[28px] p-5 lg:col-span-2">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Profile Data Operations</h2>
            <p className="mt-2 text-sm text-slate-400">Controlled generation, reputation balancing, and recovery paths for profile tooling.</p>
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Ops rail
          </div>
        </div>
        <div className="mb-3 rounded-[20px] border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          Generation status: {profileToolsStatusQuery.data?.inProgress ? "Running" : "Idle"}
          {profileToolsStatusQuery.data?.startedAt ? ` • Started ${new Date(profileToolsStatusQuery.data.startedAt).toLocaleTimeString()}` : ""}
          {profileToolsStatusQuery.data?.lastCompletedAt ? ` • Last completed ${new Date(profileToolsStatusQuery.data.lastCompletedAt).toLocaleTimeString()}` : ""}
          {profileToolsStatusQuery.data && !profileToolsStatusQuery.data.inProgress && profileToolsStatusQuery.data.cooldownRemainingMs > 0
            ? ` • Cooldown ${Math.ceil(profileToolsStatusQuery.data.cooldownRemainingMs / 1000)}s`
            : ""}
        </div>
        {profileToolsStatusQuery.data?.latestJob ? (
          <div className="mb-3 rounded-[20px] border border-slate-700/80 bg-slate-900/80 p-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Last job: {profileToolsStatusQuery.data.latestJob.title} by {profileToolsStatusQuery.data.latestJob.actor.username} at {new Date(profileToolsStatusQuery.data.latestJob.createdAt).toLocaleString()}
              </p>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${latestJobStatusToneClass}`}>
                {latestJobStatus ?? "UNKNOWN"}
              </span>
            </div>
            {profileToolsStatusQuery.data.latestJob.description ? (
              <p className="mt-2 text-slate-400">{profileToolsStatusQuery.data.latestJob.description}</p>
            ) : null}
            {latestJobResult ? (
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  Users: {latestJobResult.usersProcessed ?? 0}
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  Reputation updates: {latestJobResult.reputationUpdates ?? 0}
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  Activities: {latestJobResult.createdActivities ?? 0}
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  Medal links: {latestJobResult.totalUserMedalLinks ?? 0}
                </div>
              </div>
            ) : null}
            {latestJobError ? (
              <div className="mt-3 rounded-lg border border-rose-500/35 bg-rose-950/20 px-3 py-2 text-rose-100">
                Last failure: {latestJobError}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <Button
            variant="ghost"
            className="h-10 border border-cyan-500/35 bg-cyan-950/25 text-cyan-100"
            onClick={() => seedMedals.mutate()}
            disabled={seedMedals.isPending}
          >
            {seedMedals.isPending ? "Seeding..." : "Seed Medal Catalog"}
          </Button>
          <Button
            variant="ghost"
            className="h-10 border border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
            onClick={() => generateSampleProfiles.mutate()}
            disabled={
              generateSampleProfiles.isPending ||
              profileToolsStatusQuery.data?.inProgress ||
              generationBlockedByCooldown
            }
          >
            {generateSampleProfiles.isPending || profileToolsStatusQuery.data?.inProgress
              ? "Generating..."
              : generationBlockedByCooldown
                ? `Cooldown ${generationCooldownSeconds}s`
                : "Generate Sample Profiles"}
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2">
            <select
              aria-label="Select user for reputation adjustment"
              title="Select user for reputation adjustment"
              className="h-8 flex-1 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              {(usersQuery.data?.users ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.username}
                </option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Reputation delta"
              title="Reputation delta"
              placeholder="Delta"
              className="h-8 w-20 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
              value={reputationDelta}
              onChange={(event) => setReputationDelta(Number(event.target.value) || 0)}
            />
            <Button
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => adjustReputation.mutate()}
              disabled={adjustReputation.isPending || !selectedUserId}
            >
              Apply
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-950/10 p-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold uppercase tracking-[0.16em] text-rose-100">Advanced Recovery</p>
              <p className="mt-1 text-slate-400">
                Force-clear a stuck sample generation lock if a run is wedged and the watchdog window is too slow.
              </p>
            </div>
            <Button
              variant="ghost"
              className="h-9 border border-rose-500/35 bg-rose-950/25 px-3 text-xs text-rose-100"
              onClick={() => resetGenerationLock.mutate()}
              disabled={resetGenerationLock.isPending}
            >
              {resetGenerationLock.isPending ? "Resetting..." : "Force Reset Lock"}
            </Button>
          </div>
        </div>
        {actionNote ? <p className="mt-3 text-xs text-cyan-200">{actionNote}</p> : null}
      </section>

      <section className="nexus-panel rounded-[28px] p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Profile Tools Audit Log</h2>
            <p className="mt-2 text-sm text-slate-400">Trace profile-tool mutations, actor history, and recovery operations.</p>
          </div>
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => profileAuditQuery.refetch()}
            disabled={profileAuditQuery.isFetching}
          >
            {profileAuditQuery.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <select
            aria-label="Filter audit by action"
            title="Filter audit by action"
            className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value as "all" | "seed-medals" | "generate-sample-data" | "adjust-reputation")}
          >
            <option value="all">All actions</option>
            <option value="seed-medals">Seed medals</option>
            <option value="generate-sample-data">Generate sample data</option>
            <option value="adjust-reputation">Adjust reputation</option>
          </select>
          <select
            aria-label="Filter audit by actor"
            title="Filter audit by actor"
            className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
            value={auditActorFilter}
            onChange={(event) => setAuditActorFilter(event.target.value)}
          >
            <option value="all">All actors</option>
            {(usersQuery.data?.users ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.username}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          {(profileAuditQuery.data?.logs ?? []).map((entry) => (
            <article key={entry.id} className="rounded-[20px] border border-slate-700/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.14))] p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-cyan-100">{entry.title}</p>
                <p className="text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              {entry.description ? <p className="mt-1 text-slate-300">{entry.description}</p> : null}
              <p className="mt-2 text-slate-500">Actor: {entry.actor.username}</p>
            </article>
          ))}
          {profileAuditQuery.data && profileAuditQuery.data.logs.length === 0 ? (
            <p className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-xs text-slate-400">No profile-tool audit events yet.</p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
          <p>
            Showing {Math.min((profileAuditQuery.data?.offset ?? 0) + (profileAuditQuery.data?.logs.length ?? 0), profileAuditQuery.data?.total ?? 0)} of {profileAuditQuery.data?.total ?? 0}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setAuditOffset((prev) => Math.max(0, prev - auditPageSize))}
              disabled={auditOffset === 0 || profileAuditQuery.isFetching}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setAuditOffset((prev) => prev + auditPageSize)}
              disabled={profileAuditQuery.isFetching || (profileAuditQuery.data ? profileAuditQuery.data.offset + profileAuditQuery.data.logs.length >= profileAuditQuery.data.total : true)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
