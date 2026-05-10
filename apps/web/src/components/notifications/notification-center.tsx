"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { listNotifications, markNotificationsRead } from "@/lib/notifications-api";

export function NotificationCenter() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();

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

  return (
    <div className="nexus-panel rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-300">Notifications</h2>
        <Button className="h-9 px-3 text-xs" variant="ghost" onClick={() => markReadMutation.mutate(undefined)}>
          Mark all read
        </Button>
      </div>
      <div className="mb-3 inline-flex rounded-full border border-cyan-500/35 bg-cyan-950/25 px-2.5 py-1 text-xs text-cyan-100">
        Unread: {notificationsQuery.data?.unreadCount ?? 0}
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {notificationsQuery.data?.notifications.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border px-3 py-2 text-sm ${item.read ? "border-slate-700/80 bg-slate-900/80" : "border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-400">{item.body}</p>
              </div>
              {!item.read ? (
                <Button className="h-8 px-2 text-xs" variant="ghost" onClick={() => markReadMutation.mutate([item.id])}>
                  Read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!notificationsQuery.data?.notifications.length ? <p className="text-sm text-slate-500">No notifications.</p> : null}
      </div>
    </div>
  );
}
