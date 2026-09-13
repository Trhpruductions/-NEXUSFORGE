"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Bell, Calendar, Check, CheckCheck, Loader2, MessageSquare, Radio, ShieldAlert, UserPlus, Users } from "lucide-react";
import { listNotifications, markNotificationsRead, type NotificationItem } from "@/lib/notifications-api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type Filter = "all" | "unread" | "mentions" | "friends" | "system";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const typeMeta: Record<NotificationItem["type"], { icon: typeof Bell; tone: string; label: string }> = {
  MENTION: { icon: AtSign, tone: "text-amber-300 border-amber-400/40 bg-amber-500/10", label: "Mention" },
  FRIEND_REQUEST: { icon: UserPlus, tone: "text-sky-300 border-sky-400/40 bg-sky-500/10", label: "Friend request" },
  FRIEND_ACCEPTED: { icon: Users, tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10", label: "Friend" },
  DM: { icon: MessageSquare, tone: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10", label: "Message" },
  SYSTEM: { icon: ShieldAlert, tone: "text-slate-300 border-white/15 bg-white/5", label: "System" },
  LIVE: { icon: Radio, tone: "text-rose-300 border-rose-400/40 bg-rose-500/10", label: "Live" },
  EVENT: { icon: Calendar, tone: "text-amber-300 border-amber-400/40 bg-amber-500/10", label: "Event" },
};

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function linkFor(item: NotificationItem): string | null {
  const data = (item.data ?? {}) as Record<string, string | undefined>;
  if (item.type === "MENTION" && data.channelId) return `/app/chat?channel=${data.channelId}`;
  if (item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED") return "/app/friends";
  if (item.type === "DM" && data.threadId) return `/app/chat?dm=${data.threadId}`;
  if (item.type === "LIVE" && data.creatorId) return `/app/profile?user=${data.creatorId}`;
  if (item.type === "EVENT") return data.eventId ? `/app/events?event=${data.eventId}` : "/app/events";
  if (data.followerId) return `/app/profile?user=${data.followerId}`;
  if (data.forgeId) return "/app/server";
  return null;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [filter, setFilter] = useState<Filter>("all");

  const query = useQuery({
    queryKey: ["notifications", accessToken],
    queryFn: () => listNotifications(accessToken!, csrfToken ?? ""),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(accessToken!, csrfToken!, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = useMemo(() => {
    const list = query.data?.notifications ?? [];
    switch (filter) {
      case "unread":
        return list.filter((item) => !item.read);
      case "mentions":
        return list.filter((item) => item.type === "MENTION" || item.type === "DM");
      case "friends":
        return list.filter((item) => item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED");
      case "system":
        return list.filter((item) => item.type === "SYSTEM");
      default:
        return list;
    }
  }, [query.data, filter]);

  const unread = query.data?.unreadCount ?? 0;
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "mentions", label: "Mentions" },
    { id: "friends", label: "Friends" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Notifications</h1>
          <p className="text-xs text-slate-400">{unread ? `${unread} unread` : "You are all caught up."}</p>
        </div>
        <button type="button" className={ghostBtn} disabled={!unread || readMutation.isPending} onClick={() => readMutation.mutate(undefined)}>
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-3">
          <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
            {filters.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setFilter(entry.id)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition", filter === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white")}>
                {entry.label}
                {entry.id === "unread" && unread ? <span className={cn("ml-1.5 rounded-full px-1.5 text-[9px]", filter === entry.id ? "bg-slate-950/20" : "bg-rose-500 text-white")}>{unread}</span> : null}
              </button>
            ))}
          </div>

          {query.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
          ) : items.length ? (
            <ul className="space-y-1.5">
              {items.map((item) => {
                const meta = typeMeta[item.type] ?? typeMeta.SYSTEM;
                const href = linkFor(item);
                const body = (
                  <div className={cn("flex items-start gap-3 rounded-xl border p-3 transition", item.read ? "border-white/5 bg-[#0d1119]" : "border-amber-500/30 bg-amber-500/[0.04]")}>
                    <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.tone)}><meta.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("text-sm font-semibold", item.read ? "text-slate-200" : "text-white")}>{item.title}</p>
                        <span className="rounded border border-white/10 px-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-500">{meta.label}</span>
                        {!item.read ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                      </div>
                      <p className="text-xs text-slate-400">{item.body}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-600">{timeAgo(item.createdAt)}</p>
                    </div>
                    {!item.read ? (
                      <button type="button" onClick={(event) => { event.preventDefault(); readMutation.mutate([item.id]); }} className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:border-amber-400/50 hover:text-amber-200" title="Mark read"><Check className="h-3.5 w-3.5" /></button>
                    ) : null}
                  </div>
                );
                return <li key={item.id}>{href ? <Link href={href} onClick={() => !item.read && readMutation.mutate([item.id])}>{body}</Link> : body}</li>;
              })}
            </ul>
          ) : (
            <div className={`${panel} flex flex-col items-center py-10 text-center`}>
              <Bell className="mb-2 h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">Nothing here yet.</p>
            </div>
          )}
        </div>

        <aside className={panel}>
          <h2 className="nf-heading mb-3 text-[13px] font-bold uppercase tracking-[0.18em] text-white">What you get</h2>
          <ul className="space-y-2 text-xs text-slate-400">
            {Object.entries(typeMeta).map(([key, meta]) => (
              <li key={key} className="flex items-center gap-2"><span className={cn("flex h-6 w-6 items-center justify-center rounded-md border", meta.tone)}><meta.icon className="h-3 w-3" /></span> {meta.label}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-slate-500">Push notifications and quiet hours are in <Link href="/app/settings" className="text-amber-300">Settings</Link>.</p>
        </aside>
      </div>
    </div>
  );
}
