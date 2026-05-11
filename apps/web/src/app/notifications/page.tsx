import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default function NotificationsPage() {
  return (
    <div className="nexus-shell">
      <div className="nexus-shell-inner max-w-3xl">
        <Suspense fallback={
          <div className="nexus-metric-card rounded-2xl p-5 text-sm text-slate-400">Loading notifications...</div>
        }>
          <NotificationCenter />
        </Suspense>
      </div>
    </div>
  );
}
