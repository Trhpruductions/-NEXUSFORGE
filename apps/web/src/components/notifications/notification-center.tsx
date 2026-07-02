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
    <div className="space-y-1">
      {/* FILTER CONTROLS */}
      <div className="p-4 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="flex gap-2">
            {(["all", "unread", "activity"] as const).map((filter) => (
               <a
                  key={filter}
                  href={`/app/notifications?filter=${filter}`}
                  className={`px-4 py-2 border text-[10px] font-black uppercase tracking-widest transition ${
                  activeFilter === filter
                     ? "border-amber-500 bg-amber-500/10 text-amber-500"
                     : "border-white/10 bg-white/5 text-slate-500 hover:border-white/20 hover:text-white"
                  }`}
               >
                  {filter}
               </a>
            ))}
         </div>
         <button 
            onClick={() => markReadMutation.mutate(undefined)}
            disabled={markReadMutation.isPending || !allNotifications.length}
            className="px-4 py-2 border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest hover:border-emerald-500/50 hover:text-emerald-500 transition-all flex items-center gap-2"
         >
            <CheckCircle2 className="w-3 h-3" /> Clear_All_Alerts
         </button>
      </div>

      {/* METRIC GRID */}
      <div className="grid grid-cols-3 gap-1">
         {[
            { label: "Unread_Signals", val: notificationsQuery.data?.unreadCount ?? 0, icon: ShieldAlert },
            { label: "Visible_Nodes", val: visibleNotifications.length, icon: Filter },
            { label: "Uplink_Status", val: notificationsQuery.isFetching ? "SYNCING" : "LIVE", icon: Zap },
         ].map(stat => (
            <div key={stat.label} className="p-6 border border-white/10 bg-black/40 space-y-2">
               <div className="flex items-center gap-2 text-slate-600">
                  <stat.icon className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
               </div>
               <p className="text-xl font-black text-white italic tracking-tighter uppercase">{stat.val}</p>
            </div>
         ))}
      </div>

      {/* NOTIFICATION FEED */}
      <div className="space-y-1">
         {visibleNotifications.length > 0 ? (
            visibleNotifications.map((note) => (
               <div key={note.id} className={`p-6 border border-white/10 bg-black/40 flex items-start gap-6 group hover:bg-white/5 transition-all ${!note.read ? 'border-l-amber-500 border-l-2' : ''}`}>
                  <div className={`w-10 h-10 border border-white/10 bg-slate-900 flex items-center justify-center ${!note.read ? 'text-amber-500' : 'text-slate-600'}`}>
                     <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                     <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">{note.type || 'SYSTEM_LOG'}</span>
                     <h3 className="text-lg font-black text-white uppercase italic tracking-wider">{note.title}</h3>
                     <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">{note.body}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                     <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{new Date(note.createdAt).toLocaleTimeString()}</span>
                     {!note.read && (
                        <button 
                           onClick={() => markReadMutation.mutate([note.id])}
                           className="opacity-0 group-hover:opacity-100 px-3 py-1 border border-amber-500/20 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                        >
                           ACKNOWLEDGE
                        </button>
                     )}
                  </div>
               </div>
            ))
         ) : (
            <div className="p-12 border border-white/5 bg-black/20 text-center space-y-4">
               <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto" />
               <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">No_Active_Signals_Detected</p>
            </div>
         )}
      </div>
    </div>
  );
}
