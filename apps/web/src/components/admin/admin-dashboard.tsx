"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { api, authHeaders } from "@/lib/api";
import { getAdminAiInsights, getAdminRevenue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function AdminDashboard() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();

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

  if (!accessToken || !csrfToken) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
        Sign in with an admin account to access moderation tools.
      </div>
    );
  }

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
          </div>
        )}
      </section>
    </div>
  );
}
