"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuthStore } from "@/store/auth-store";
import { api, authHeaders } from "@/lib/api";
import { adminAdjustReputation, adminGenerateSampleProfiles, adminSeedMedals, getAdminAiInsights, getAdminProfileAudit, getAdminProfileToolsStatus, getAdminRevenue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "seed-medals" | "generate-sample-data" | "adjust-reputation">("all");
  const [auditActorFilter, setAuditActorFilter] = useState<string>("all");
  const [auditOffset, setAuditOffset] = useState<number>(0);
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
      const response = await api.get<{ users: Array<{ id: string; username: string; email: string; isAdmin: boolean; premium: boolean; status: string }> }>(
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

  const toggleAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post<{ user: { id: string; username: string; isAdmin: boolean } }>(
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

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.users?.length) {
      setSelectedUserId(usersQuery.data.users[0]!.id);
    }
  }, [selectedUserId, usersQuery.data?.users]);

  useEffect(() => {
    setAuditOffset(0);
  }, [auditActionFilter, auditActorFilter]);

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
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
        Sign in with an admin account to access moderation tools.
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <section className="nexus-panel rounded-2xl p-5">
        <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-300">Admin Summary</h2>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
          <div className="glass-cut rounded-xl p-3">Users: {summaryQuery.data?.users ?? 0}</div>
          <div className="glass-cut rounded-xl p-3">Forges: {summaryQuery.data?.forges ?? 0}</div>
          <div className="glass-cut rounded-xl p-3">Messages: {summaryQuery.data?.messages ?? 0}</div>
          <div className="glass-cut rounded-xl p-3">Notifications: {summaryQuery.data?.notifications ?? 0}</div>
          <div className="glass-cut rounded-xl p-3">Pending Friend Requests: {summaryQuery.data?.pendingFriends ?? 0}</div>
          <div className="glass-cut rounded-xl p-3">Active Subscriptions: {revenueQuery.data?.revenue.activeSubscriptions ?? 0}</div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-200">
          <div className="glass-cut rounded-xl p-3">
            Revenue 30d: <span className="font-semibold text-emerald-200">{formatUsd(revenueQuery.data?.revenue.last30DaysCents ?? 0)}</span>
          </div>
          <div className="glass-cut rounded-xl p-3">
            Revenue Growth: <span className="font-semibold text-cyan-200">{revenueQuery.data?.revenue.growthPct ?? 0}%</span>
          </div>
          <div className="glass-cut rounded-xl p-3">
            Failed Payments (30d): <span className="font-semibold text-rose-200">{revenueQuery.data?.revenue.failedPayments ?? 0}</span>
          </div>
        </div>
      </section>

      <section className="nexus-panel rounded-2xl p-5">
        <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-300">Moderation Queue</h2>
        <div className="space-y-2">
          {usersQuery.data?.users.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-sm text-slate-200 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
              <div>
                <p>{entry.username}</p>
                <p className="text-xs text-slate-400">{entry.email}</p>
              </div>
              <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => toggleAdmin.mutate(entry.id)}>
                {entry.isAdmin ? "Revoke Admin" : "Make Admin"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="nexus-panel rounded-2xl p-5 lg:col-span-2">
        <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-300">Billing Mix (Last 30 Days)</h2>
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
                <tr key={row.featureCode} className="border-b border-slate-800/70 text-slate-200">
                  <td className="py-2 pr-3 font-medium text-slate-100">{row.featureCode}</td>
                  <td className="py-2 pr-3 text-emerald-200">{formatUsd(row.revenueCents)}</td>
                  <td className="py-2">{row.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="glass-cut rounded-xl p-3 text-sm text-slate-200">CORE: {revenueQuery.data?.tierDistribution.CORE ?? 0}</div>
          <div className="glass-cut rounded-xl p-3 text-sm text-slate-200">PLUS: {revenueQuery.data?.tierDistribution.PLUS ?? 0}</div>
          <div className="glass-cut rounded-xl p-3 text-sm text-slate-200">ELITE: {revenueQuery.data?.tierDistribution.ELITE ?? 0}</div>
          <div className="glass-cut rounded-xl p-3 text-sm text-slate-200">INFINITE: {revenueQuery.data?.tierDistribution.INFINITE ?? 0}</div>
        </div>
      </section>

      <section className="nexus-panel rounded-2xl p-5 lg:col-span-2">
        <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-300">Advanced Moderation AI</h2>
        {aiInsightsQuery.isError ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 text-sm text-amber-100">
            Advanced moderation intelligence is payment-gated. Unlock it from the <Link href="/pricing" className="font-semibold underline">pricing center</Link>.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="glass-cut rounded-xl p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Pressure Score</p>
              <p className="mt-2 text-3xl font-semibold text-rose-200">{aiInsightsQuery.data?.insights.pressureScore ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent Messages</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-100">{aiInsightsQuery.data?.insights.recentMessages ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">New Accounts 7d</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-100">{aiInsightsQuery.data?.insights.recentAccounts ?? 0}</p>
            </div>
            <div className="glass-cut rounded-xl p-4 text-slate-200 md:col-span-3">
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

      <section className="nexus-panel rounded-2xl p-5 lg:col-span-2">
        <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-cyan-300">Profile Data Operations</h2>
        <div className="mb-3 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          Generation status: {profileToolsStatusQuery.data?.inProgress ? "Running" : "Idle"}
          {profileToolsStatusQuery.data?.startedAt ? ` • Started ${new Date(profileToolsStatusQuery.data.startedAt).toLocaleTimeString()}` : ""}
          {profileToolsStatusQuery.data?.lastCompletedAt ? ` • Last completed ${new Date(profileToolsStatusQuery.data.lastCompletedAt).toLocaleTimeString()}` : ""}
          {profileToolsStatusQuery.data && !profileToolsStatusQuery.data.inProgress && profileToolsStatusQuery.data.cooldownRemainingMs > 0
            ? ` • Cooldown ${Math.ceil(profileToolsStatusQuery.data.cooldownRemainingMs / 1000)}s`
            : ""}
        </div>
        {profileToolsStatusQuery.data?.latestJob ? (
          <div className="mb-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-xs text-slate-300">
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
        {actionNote ? <p className="mt-3 text-xs text-cyan-200">{actionNote}</p> : null}
      </section>

      <section className="nexus-panel rounded-2xl p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Profile Tools Audit Log</h2>
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
            <article key={entry.id} className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-xs text-slate-200">
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
