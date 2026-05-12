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
      <div className="nexus-display-panel relative overflow-hidden rounded-[28px] p-5">
        <div className="nexus-ambient" aria-hidden="true">
          <div className="nexus-ambient-orb nexus-ambient-orb-a" />
          <div className="nexus-ambient-orb nexus-ambient-orb-c" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400">Inbox</p>
            <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-semibold tracking-tight text-white">Notifications</h1>
            <p className="mt-1 text-sm text-slate-400">Prioritize urgent signals, review activity bursts, and keep the live feed under control.</p>
          </div>
          <Button className="h-9 px-4 text-xs" variant="ghost" onClick={() => markReadMutation.mutate(undefined)} disabled={markReadMutation.isPending || !allNotifications.length}>
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
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

        <div className="nexus-signal-rail rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Filter Rail</p>
          <p className="mt-1 text-sm text-slate-300">Move between unread priority, all traffic, and event-driven activity without leaving the current feed.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "unread", "activity"] as const).map((filter) => (
          <a
            key={filter}
            href={`/notifications?filter=${filter}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition ${
              activeFilter === filter
                ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]"
                : "border-slate-700/80 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {filter}
          </a>
        ))}
      </div>

      <div className="space-y-2">
        {notificationsQuery.isLoading ? (
          <div className="nexus-metric-card rounded-2xl p-5 text-center text-sm text-slate-400">Loading notifications...</div>
        ) : null}
        {!notificationsQuery.isLoading && !visibleNotifications.length ? (
          <div className="nexus-display-panel rounded-[24px] p-6 text-center">
            <p className="text-sm font-medium text-slate-300">All caught up</p>
            <p className="mt-1 text-xs text-slate-500">No notifications to show right now.</p>
          </div>
        ) : null}
        {visibleNotifications.map((item) => (
          <div
            key={item.id}
            className={`nexus-interactive-card relative overflow-hidden rounded-[24px] border px-4 py-4 ${
              item.read
                ? "border-slate-700/80 bg-slate-900/80"
                : "border-cyan-500/40 bg-[linear-gradient(145deg,rgba(8,47,73,0.38),rgba(15,23,42,0.84))] shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
            }`}
          >
            {!item.read ? <div className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[24px] bg-gradient-to-b from-cyan-300 to-cyan-500" /> : null}
            <div className="flex items-start justify-between gap-3 pl-1">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  {!item.read ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" /> : null}
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.read ? "Archived" : "Priority"}</span>
                </div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p>
              </div>
              {!item.read ? (
                <Button className="h-8 shrink-0 px-3 text-xs" variant="ghost" onClick={() => markReadMutation.mutate([item.id])} disabled={markReadMutation.isPending}>
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
