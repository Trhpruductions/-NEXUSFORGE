"use client";

import { UserActivity } from "@/lib/api";
import { format } from "date-fns";

type ActivityFeedProps = {
  activities: UserActivity[];
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (type: UserActivity["type"]) => {
    switch (type) {
      case "JOINED_FORGE":
        return "🚀";
      case "CREATED_FORGE":
        return "✨";
      case "MESSAGE_SENT":
        return "💬";
      case "FRIEND_ADDED":
        return "👥";
      case "MEDAL_EARNED":
        return "🏅";
      case "LEVEL_UP":
        return "📈";
      case "PREMIUM_UPGRADE":
        return "👑";
      case "CUSTOM":
        return "📌";
      default:
        return "•";
    }
  };

  if (activities.length === 0) {
    return (
      <div className="nexus-display-panel rounded-[20px] py-8 text-center text-slate-500">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="nexus-metric-card nexus-interactive-card flex gap-4 rounded-[20px] border border-slate-900/10 p-3"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] border border-slate-900/10 bg-slate-50 text-xl">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate font-semibold text-amber-700">
              {activity.title}
            </div>
            {activity.description && (
              <div className="truncate text-sm text-slate-500">
                {activity.description}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 whitespace-nowrap text-[11px] text-slate-500">
            {format(new Date(activity.createdAt), "MMM d, HH:mm")}
          </div>
        </div>
      ))}
    </div>
  );
}

