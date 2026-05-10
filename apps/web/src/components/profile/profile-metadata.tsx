"use client";

import { User } from "@/lib/api";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return "just now";
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 30) return `${daysAgo}d ago`;
  const monthsAgo = Math.floor(daysAgo / 30);
  if (monthsAgo < 12) return `${monthsAgo}mo ago`;
  const yearsAgo = Math.floor(monthsAgo / 12);
  return `${yearsAgo}y ago`;
}

export function ProfileMetadata({ user }: { user: User }) {
  const joinDate = new Date(user.createdAt);
  const joinDateFormatted = formatTimeAgo(joinDate);

  const getTierLabel = () => {
    if (user.premiumTier && user.premiumTier !== "NONE") {
      return `${user.premiumTier} Tier`;
    }
    return "Free";
  };

  const getBoostLevel = () => {
    if (user.corePlusBoostLevel && user.corePlusBoostLevel > 0) {
      return `Level ${user.corePlusBoostLevel}`;
    }
    return "Not Activated";
  };

  return (
    <div className="mb-8 rounded-lg border border-slate-700/50 bg-slate-900/50 p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Account Profile</p>
        <h2 className="mt-2 text-lg font-bold text-slate-50">{user.username}</h2>
        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Join Date</p>
          <p className="mt-1 text-sm font-medium text-slate-200">
            {joinDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-slate-500">{joinDateFormatted}</p>
        </div>

        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Subscription Tier</p>
          <p className={`mt-1 text-sm font-medium ${user.premium ? "text-amber-300" : "text-slate-300"}`}>{getTierLabel()}</p>
          {user.premium && user.corePlusActivatedAt && (
            <p className="text-xs text-slate-500">
              Since{" "}
              {new Date(user.corePlusActivatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Core+ Boost Level</p>
          <p className={`mt-1 text-sm font-medium ${user.corePlusBoostLevel && user.corePlusBoostLevel > 0 ? "text-green-300" : "text-slate-400"}`}>{getBoostLevel()}</p>
          {user.corePlusStreakDays && user.corePlusStreakDays > 0 && <p className="text-xs text-slate-500">Streak: {user.corePlusStreakDays} days</p>}
        </div>

        {typeof user.appRank === "number" ? (
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">App Rank</p>
            <p className="mt-1 text-sm font-semibold text-amber-300">#{user.appRank}</p>
            <p className="text-xs text-slate-500">Global reputation standing</p>
          </div>
        ) : null}

        {typeof user.boostRank === "number" ? (
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Boost Rank</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">#{user.boostRank}</p>
            <p className="text-xs text-slate-500">Core+ boost leaderboard</p>
          </div>
        ) : null}
      </div>

      {user.clanTag && (
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Clan Tag</p>
          <p className="mt-1 text-sm font-mono font-bold text-cyan-300">[{user.clanTag}]</p>
        </div>
      )}
    </div>
  );
}
