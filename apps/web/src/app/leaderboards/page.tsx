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

type Category = "reputation" | "streaks" | "medals";
const categories: Category[] = ["reputation", "streaks", "medals"];

export default function LeaderboardsPage() {
  const { user: currentUser, accessToken } = useAuthStore();
  const isSignedIn = Boolean(currentUser && accessToken);
  const loginRedirect = `/login?redirect=/leaderboards`;

  const [activeTab, setActiveTab] = useState<Category>("reputation");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadLeaderboard = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await getLeaderboard(accessToken!, activeTab, 100, 0);
        if (!cancelled) setLeaderboard(data.leaderboard);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
        if (!cancelled) {
          setLeaderboard([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
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
      subtitle="The top players by reputation, streaks and medals."
      metrics={[
        { label: "Category", value: isSignedIn ? activeTab.toUpperCase() : "Locked", tone: "amber" },
        { label: "Players", value: isSignedIn && !loading && !loadError ? `${leaderboard.length}` : "—", tone: "amber" },
        { label: "Showing", value: isSignedIn ? (loading ? "Loading" : loadError ? "Unavailable" : "Top 100") : "Locked", tone: "amber" },
      ]}
      actions={
        isSignedIn
          ? [
              { label: "Search users", href: "/search", tone: "ghost" },
              { label: "Open app", href: "/app", tone: "primary" },
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
        <>
          <div role="group" aria-label="Leaderboard category" className="mb-4 flex gap-1 rounded-[22px] border border-white/10 bg-[#0d1119] p-1">
            {categories.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-[18px] py-2.5 text-xs font-semibold capitalize transition ${
                    active ? "bg-amber-400 text-slate-950 shadow-[0_10px_24px_rgba(30,139,255,0.25)]" : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div role="status" className="rounded-[28px] border border-white/10 bg-[#0d1119] p-6 text-center text-sm text-slate-300">
              Loading leaderboard...
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-[28px] border border-rose-400/30 bg-rose-500/10 p-6 text-center text-sm text-rose-200">
              Couldn&apos;t load these rankings right now. Pick a category to try again.
            </div>
          ) : !leaderboard.length ? (
            <div className="rounded-[28px] border border-white/10 bg-[#0d1119] p-8 text-center">
              <p className="text-sm font-semibold text-white">No players are ranked in this category yet.</p>
              <p className="mt-1 text-sm text-slate-400">Check back later, or try another category.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((entry, index) => {
                const rowBadges = getProfileBadgesForUser({
                  premiumTier: (entry.premiumTier as "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE" | undefined) ?? "NONE",
                  appRole: undefined,
                  isAdmin: false,
                  corePlusBoostLevel: entry.corePlusBoostLevel,
                });

                return (
                  <li key={entry.id}>
                    <Link
                      href={`/profiles/${entry.id}`}
                      className="nexus-interactive-card flex items-center gap-3 rounded-[24px] border border-white/10 bg-[#11151e] px-3 py-3 shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:gap-4 sm:px-4 sm:py-4"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white sm:h-10 sm:w-10 ${getMedalColor(entry.premiumTier)}`}
                      >
                        {index + 1}
                      </span>

                      {entry.avatar ? (
                        <Image src={entry.avatar} alt="" width={40} height={40} className="h-9 w-9 shrink-0 rounded-full object-cover aspect-square sm:h-10 sm:w-10" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0d1119] text-sm font-bold text-slate-300 sm:h-10 sm:w-10"
                        >
                          {entry.username[0]?.toUpperCase()}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{entry.username}</p>
                        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-slate-400">
                          {entry.clanTag ? <span className="text-amber-200">[{entry.clanTag}]</span> : null}
                          <span>Rank #{index + 1}</span>
                        </p>
                        <ProfileBadgeStrip badges={rowBadges} containerClassName="mt-2" />
                      </div>

                      <div className="shrink-0 rounded-[18px] border border-white/10 bg-[#0d1119] px-3 py-2 text-right">
                        {activeTab === "reputation" ? (
                          <>
                            <span className="block text-lg font-bold text-amber-200">{entry.reputation ?? 0}</span>
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-400">Rep</span>
                          </>
                        ) : null}
                        {activeTab === "streaks" ? (
                          <>
                            <span className="block text-lg font-bold text-amber-200">{entry.corePlusBoostLevel ?? 0}</span>
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-400">Boost · {entry.corePlusStreakDays ?? 0}d</span>
                          </>
                        ) : null}
                        {activeTab === "medals" ? (
                          <>
                            <span className="block text-lg font-bold text-amber-200">{entry.medalCount ?? 0}</span>
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-400">Medals</span>
                          </>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </ExperienceShell>
  );
}
