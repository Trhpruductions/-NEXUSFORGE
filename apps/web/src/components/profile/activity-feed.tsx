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
      <div className="text-center py-8 text-slate-400">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-4 p-3 bg-slate-900 rounded hover:bg-slate-800 transition"
        >
          <div className="text-2xl flex-shrink-0">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-cyan-400 truncate">
              {activity.title}
            </div>
            {activity.description && (
              <div className="text-sm text-slate-400 truncate">
                {activity.description}
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
            {format(new Date(activity.createdAt), "MMM d, HH:mm")}
          </div>
        </div>
      ))}
    </div>
  );
}
