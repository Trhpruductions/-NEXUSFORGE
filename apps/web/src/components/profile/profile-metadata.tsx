"use client";

import { User } from "@/lib/api";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";

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
  const profileBadges = getProfileBadgesForUser(user);

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
    <section className="nexus-display-panel mb-8 rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Account Profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-50">{user.username}</h2>
          <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        </div>
        <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-950/25 px-3 py-1 text-xs text-cyan-100">
          Joined {joinDateFormatted}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="nexus-metric-card nexus-interactive-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Join Date</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {joinDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </article>

        <article className="nexus-metric-card nexus-interactive-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Subscription Tier</p>
          <p className={`mt-1 text-sm font-semibold ${user.premium ? "text-amber-300" : "text-slate-300"}`}>{getTierLabel()}</p>
          {user.premium && user.corePlusActivatedAt ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Since {new Date(user.corePlusActivatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          ) : null}
        </article>

        <article className="nexus-metric-card nexus-interactive-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Core+ Boost</p>
          <p className={`mt-1 text-sm font-semibold ${user.corePlusBoostLevel && user.corePlusBoostLevel > 0 ? "text-emerald-300" : "text-slate-400"}`}>{getBoostLevel()}</p>
          {user.corePlusStreakDays && user.corePlusStreakDays > 0 ? <p className="mt-1 text-[11px] text-slate-500">Streak: {user.corePlusStreakDays} days</p> : null}
        </article>

        <article className="nexus-metric-card nexus-interactive-card rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Leaderboard</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {typeof user.appRank === "number" ? `App #${user.appRank}` : "App rank pending"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {typeof user.boostRank === "number" ? `Boost #${user.boostRank}` : "Boost rank pending"}
          </p>
        </article>
      </div>

      {user.clanTag ? (
        <div className="nexus-display-panel mt-4 rounded-[22px] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Clan Tag</p>
          <p className="mt-1 text-sm font-mono font-bold text-cyan-300">[{user.clanTag}]</p>
        </div>
      ) : null}

      {profileBadges.length ? (
        <div className="nexus-display-panel mt-4 rounded-[22px] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Profile Badges</p>
          <ProfileBadgeStrip
            badges={profileBadges}
            maxItems={6}
            showLabel
            containerClassName="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            imageClassName="h-auto w-full"
            itemClassName="rounded-xl border-slate-700/75 bg-slate-950/65"
          />
        </div>
      ) : null}
    </section>
  );
}
