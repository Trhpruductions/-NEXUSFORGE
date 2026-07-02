"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getLeaderboard, LeaderboardEntry } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";

export default function LeaderboardsPage() {
  const { user: currentUser, accessToken } = useAuthStore();
  const isSignedIn = Boolean(currentUser && accessToken);
  const loginRedirect = `/login?redirect=/leaderboards`;

  const [activeTab, setActiveTab] = useState<"reputation" | "streaks" | "medals">("reputation");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getLeaderboard(accessToken!, activeTab, 100, 0);
        setLeaderboard(data.leaderboard);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeTab, accessToken, isSignedIn]);

  const getMedalColor = (tier?: string) => {
    switch (tier) {
      case "INFINITE":
        return "from-yellow-600 to-yellow-400";
      case "ELITE":
        return "from-purple-600 to-purple-400";
      case "PLUS":
        return "from-blue-600 to-blue-400";
      case "CORE":
        return "from-amber-600 to-amber-400";
      default:
        return "from-slate-700 to-slate-600";
    }
  };

  return (
    <ExperienceShell
      eyebrow="Rankings"
      title="Leaderboards"
      subtitle="Track global reputation, streak momentum, and medal dominance in one competitive command feed."
      metrics={[
        { label: "Category", value: isSignedIn ? activeTab.toUpperCase() : "Locked", tone: "amber" },
        { label: "Players", value: isSignedIn ? `${leaderboard.length}` : "—", tone: "amber" },
        { label: "Feed", value: isSignedIn ? (loading ? "Syncing" : "Live") : "Locked", tone: "amber" },
      ]}
      actions={
        isSignedIn
          ? [
              { label: "Search Users", href: "/search", tone: "ghost" },
              { label: "App", href: "/app", tone: "primary" },
            ]
          : [
              { label: "Sign in", href: loginRedirect, tone: "ghost" },
              { label: "Create account", href: "/register?redirect=/leaderboards", tone: "primary" },
            ]
      }
      maxWidthClassName="max-w-4xl"
    >
      {!isSignedIn ? (
        <GuestAuthCallout
          title="Leaderboards are available after signing in."
          description="Sign in to browse reputation rankings, streaks, and league medals."
          loginHref={loginRedirect}
          registerHref="/register?redirect=/leaderboards"
        />
      ) : (
        <div className="nexus-display-panel mb-5 rounded-[28px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Leaderboard pulse</p>
              <p className="mt-2 text-sm text-slate-600">The ranking feed refreshes live with reputation, streaks, and medal momentum.</p>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs uppercase tracking-[0.16em] text-amber-700">
              Season closes in 2d
            </div>
          </div>
        </div>
      )}

      {isSignedIn ? (
        <>
          <div className="nexus-display-panel rounded-[28px] p-1.5">
            <div className="flex gap-1 rounded-[24px] border border-slate-900/10 bg-white/80 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              {(["reputation", "streaks", "medals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-semibold capitalize transition ${
                    activeTab === tab
                      ? "rounded-[20px] bg-amber-500 text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.18)]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="nexus-display-panel rounded-[28px] p-5 text-center text-sm text-slate-600">Loading leaderboard...</div>
          ) : (
            <div className="space-y-2">
              {!leaderboard.length ? (
                <div className="nexus-display-panel rounded-[28px] p-8 text-center">
                  <p className="text-sm text-slate-600">No entries yet for this category</p>
                </div>
              ) : null}
              {leaderboard.map((entry, index) => {
                const rowBadges = getProfileBadgesForUser({
                  premiumTier: (entry.premiumTier as "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE" | undefined) ?? "NONE",
                  appRole: undefined,
                  isAdmin: false,
                  corePlusBoostLevel: entry.corePlusBoostLevel,
                });

                return (
                  <Link
                    key={entry.id}
                    href={`/profiles/${entry.id}`}
                    className="nexus-interactive-card flex items-center gap-4 rounded-[24px] border border-slate-900/10 bg-white/85 px-4 py-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-slate-950 ${getMedalColor(entry.premiumTier)}`}>
                      {index + 1}
                    </div>

                    {entry.avatar ? (
                      <Image
                        src={entry.avatar}
                        alt={entry.username}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover aspect-square"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-900/10 bg-slate-100 text-sm font-bold text-slate-700">
                        {entry.username[0]?.toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">{entry.username}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {entry.clanTag ? <p className="text-amber-700">[{entry.clanTag}]</p> : null}
                        <span className="text-slate-500">Rank #{index + 1}</span>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-[20px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-right">
                      {activeTab === "reputation" ? <span className="text-lg font-bold text-amber-700">{entry.reputation ?? 0}</span> : null}
                      {activeTab === "streaks" ? (
                        <div>
                          <span className="text-lg font-bold text-amber-700">{entry.corePlusBoostLevel ?? 0}</span>
                          <p className="text-[10px] text-slate-500">{entry.corePlusStreakDays ?? 0}d</p>
                        </div>
                      ) : null}
                      {activeTab === "medals" ? <span className="text-lg font-bold text-yellow-600">{entry.medalCount ?? 0}</span> : null}
                      <ProfileBadgeStrip badges={rowBadges} containerClassName="mt-2 justify-end" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </ExperienceShell>
  );
}

