"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getLeaderboard, LeaderboardEntry } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";

export default function LeaderboardsPage() {
  const { user: currentUser, accessToken } = useAuthStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"reputation" | "streaks" | "medals">("reputation");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !accessToken) {
      router.push("/login");
      return;
    }

    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getLeaderboard(accessToken, activeTab, 100, 0);
        setLeaderboard(data.leaderboard);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeTab, currentUser, accessToken, router]);

  const getMedalColor = (tier?: string) => {
    switch (tier) {
      case "INFINITE":
        return "from-yellow-600 to-yellow-400";
      case "ELITE":
        return "from-purple-600 to-purple-400";
      case "PLUS":
        return "from-blue-600 to-blue-400";
      case "CORE":
        return "from-emerald-600 to-emerald-400";
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
        { label: "Category", value: activeTab.toUpperCase(), tone: "cyan" },
        { label: "Players", value: `${leaderboard.length}`, tone: "emerald" },
        { label: "Feed", value: loading ? "Syncing" : "Live", tone: "amber" },
      ]}
      actions={[
        { label: "Search Users", href: "/search", tone: "ghost" },
        { label: "App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-4xl"
    >
      <div className="nexus-display-panel rounded-[24px] p-1.5">
        <div className="flex gap-1 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-1">
        {(["reputation", "streaks", "medals"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition ${
              activeTab === tab
                ? "bg-cyan-950/60 text-cyan-200 shadow-[inset_0_1px_0_rgba(34,211,238,0.12)]"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="nexus-display-panel rounded-[24px] p-5 text-center text-sm text-slate-400">Loading leaderboard...</div>
      ) : (
        <div className="space-y-2">
          {!leaderboard.length ? (
            <div className="nexus-display-panel rounded-[24px] p-8 text-center">
              <p className="text-sm text-slate-400">No entries yet for this category</p>
            </div>
          ) : null}
          {leaderboard.map((entry, index) => (
            (() => {
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
              className="nexus-interactive-card flex items-center gap-4 rounded-[24px] border border-slate-800 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.16))] px-4 py-4"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold ${getMedalColor(entry.premiumTier)}`}>
                {index + 1}
              </div>

              {entry.avatar ? (
                <Image src={entry.avatar} alt={entry.username} width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300">
                  {entry.username[0]?.toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{entry.username}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {entry.clanTag ? <p className="text-cyan-400">[{entry.clanTag}]</p> : null}
                  <span className="text-slate-500">Rank #{index + 1}</span>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                {activeTab === "reputation" ? <span className="text-lg font-bold text-cyan-300">{entry.reputation ?? 0}</span> : null}
                {activeTab === "streaks" ? (
                  <div>
                    <span className="text-lg font-bold text-emerald-300">{entry.corePlusBoostLevel ?? 0}</span>
                    <p className="text-[10px] text-slate-500">{entry.corePlusStreakDays ?? 0}d</p>
                  </div>
                ) : null}
                {activeTab === "medals" ? <span className="text-lg font-bold text-yellow-300">{entry.medalCount ?? 0}</span> : null}
                <ProfileBadgeStrip badges={rowBadges} maxItems={2} containerClassName="mt-2 justify-end" />
              </div>
            </Link>
              );
            })()
          ))}
        </div>
      )}
    </ExperienceShell>
  );
}
