"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { listNotifications, markNotificationsRead } from "@/lib/notifications-api";
import { Bell, ShieldAlert, Zap, Filter, CheckCircle2 } from "lucide-react";

type NotificationFilter = "all" | "unread" | "activity";

function isActivityNotification(title: string, body: string): boolean {
  return /(activity|raid|match|lobby|event|game)/i.test(`${title} ${body}`);
}

export function NotificationCenter() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedFilter = (searchParams?.get("filter") ?? "all") as NotificationFilter;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11151e] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-xl">
         <div className="flex gap-2">
            {(["all", "unread", "activity"] as const).map((filter) => (
               <a
                  key={filter}
                  href={`/app/notifications?filter=${filter}`}
                  className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest transition ${
                  activeFilter === filter
                     ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                     : "border-white/10 bg-amber-400 text-slate-500 hover:border-white/20 hover:text-slate-950"
                  }`}
               >
                  {filter}
               </a>
            ))}
         </div>
         <button 
            onClick={() => markReadMutation.mutate(undefined)}
            disabled={markReadMutation.isPending || !allNotifications.length}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-amber-400 px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-[#0d1119] hover:text-slate-950"
         >
            <CheckCircle2 className="w-3 h-3" /> Clear all
         </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
         {[
            { label: "Unread_Signals", val: notificationsQuery.data?.unreadCount ?? 0, icon: ShieldAlert },
            { label: "Visible_Nodes", val: visibleNotifications.length, icon: Filter },
            { label: "Uplink_Status", val: notificationsQuery.isFetching ? "SYNCING" : "LIVE", icon: Zap },
         ].map(stat => (
            <div key={stat.label} className="space-y-2 rounded-[24px] border border-white/10 bg-[#11151e] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-xl">
               <div className="flex items-center gap-2 text-slate-500">
                  <stat.icon className="w-3 h-3" />
                  <span className="text-[9px] font-semibold uppercase tracking-widest">{stat.label}</span>
               </div>
               <p className="text-xl font-semibold tracking-tight text-white uppercase">{stat.val}</p>
            </div>
         ))}
      </div>

      <div className="space-y-3">
         {visibleNotifications.length > 0 ? (
            visibleNotifications.map((note) => (
               <div key={note.id} className={`group flex items-start gap-6 rounded-[24px] border bg-[#11151e] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition-colors hover:bg-amber-400 ${!note.read ? 'border-amber-200 border-l-2' : 'border-slate-900/10'}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1119] ${!note.read ? 'text-amber-600' : 'text-slate-500'}`}>
                     <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                     <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{note.type || 'System log'}</span>
                     <h3 className="text-lg font-semibold tracking-tight text-white">{note.title}</h3>
                     <p className="text-[11px] font-medium tracking-wide leading-relaxed text-slate-500">{note.body}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                     <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{new Date(note.createdAt).toLocaleTimeString()}</span>
                     {!note.read && (
                        <button 
                           onClick={() => markReadMutation.mutate([note.id])}
                           className="opacity-0 transition-opacity group-hover:opacity-100 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[8px] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-100"
                        >
                           Acknowledge
                        </button>
                     )}
                  </div>
               </div>
            ))
         ) : (
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-[#11151e] p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
               <ShieldAlert className="mx-auto w-12 h-12 text-slate-300" />
               <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">No active signals detected</p>
            </div>
         )}
      </div>
    </div>
  );
}
