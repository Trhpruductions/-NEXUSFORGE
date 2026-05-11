"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { listNotifications, markNotificationsRead } from "@/lib/notifications-api";

type NotificationFilter = "all" | "unread" | "activity";

function isActivityNotification(title: string, body: string): boolean {
  return /(activity|raid|match|lobby|event|game)/i.test(`${title} ${body}`);
}

export function NotificationCenter() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedFilter = (searchParams.get("filter") ?? "all") as NotificationFilter;
  const activeFilter: NotificationFilter = ["all", "unread", "activity"].includes(requestedFilter) ? requestedFilter : "all";

  const notificationsQuery = useQuery({
    queryKey: ["notifications", accessToken],
    queryFn: () => listNotifications(accessToken!, csrfToken!),
    enabled: Boolean(accessToken && csrfToken),
  });

  const markReadMutation = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(accessToken!, csrfToken!, ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", accessToken] });
    },
  });

  if (!accessToken || !csrfToken) {
    return null;
  }

  const allNotifications = notificationsQuery.data?.notifications ?? [];
  const visibleNotifications = allNotifications.filter((item) => {
    if (activeFilter === "unread") return !item.read;
    if (activeFilter === "activity") return isActivityNotification(item.title, item.body);
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400">Inbox</p>
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-semibold tracking-tight text-white">Notifications</h1>
        </div>
        <Button className="h-9 px-4 text-xs" variant="ghost" onClick={() => markReadMutation.mutate(undefined)} disabled={markReadMutation.isPending || !allNotifications.length}>
          Mark all read
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="nexus-metric-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Unread</p>
          <p className="mt-1 text-xl font-semibold text-cyan-300">{notificationsQuery.data?.unreadCount ?? 0}</p>
        </div>
        <div className="nexus-metric-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Visible</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{visibleNotifications.length}</p>
        </div>
        <div className="nexus-metric-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Feed</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">{notificationsQuery.isFetching ? "Syncing" : "Live"}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unread", "activity"] as const).map((filter) => (
          <a
            key={filter}
            href={`/notifications?filter=${filter}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition ${
              activeFilter === filter
                ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-200"
                : "border-slate-700/80 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {filter}
          </a>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-2">
        {notificationsQuery.isLoading ? (
          <div className="nexus-metric-card rounded-2xl p-5 text-center text-sm text-slate-400">Loading notifications...</div>
        ) : null}
        {!notificationsQuery.isLoading && !visibleNotifications.length ? (
          <div className="nexus-metric-card rounded-2xl p-6 text-center">
            <p className="text-sm font-medium text-slate-300">All caught up</p>
            <p className="mt-1 text-xs text-slate-500">No notifications to show right now.</p>
          </div>
        ) : null}
        {visibleNotifications.map((item) => (
          <div
            key={item.id}
            className={`nexus-interactive-card rounded-2xl border px-4 py-3 ${
              item.read
                ? "border-slate-700/80 bg-slate-900/80"
                : "border-cyan-500/40 bg-cyan-950/25 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {!item.read ? <span className="mb-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" /> : null}
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{item.body}</p>
              </div>
              {!item.read ? (
                <Button className="h-7 shrink-0 px-2.5 text-xs" variant="ghost" onClick={() => markReadMutation.mutate([item.id])} disabled={markReadMutation.isPending}>
                  Read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
