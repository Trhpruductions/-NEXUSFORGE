import { NotificationCenter } from "@/components/notifications/notification-center";

export default function NotificationsPage() {
  return (
    <div className="nexus-shell px-4 py-6 sm:px-8">
      <div className="nexus-shell-inner max-w-4xl space-y-4">
        <div className="nexus-hero">
          <p className="nexus-eyebrow text-cyan-300">Signals</p>
          <h1 className="nexus-title mt-2 text-slate-50">Notification Center</h1>
          <p className="nexus-subtitle mt-2 text-slate-400">Track mentions, direct messages, friend requests, and system alerts.</p>
        </div>
        <NotificationCenter />
      </div>
    </div>
  );
}
