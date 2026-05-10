"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getLeaderboard, LeaderboardEntry } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Leaderboards</h1>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {(["reputation", "streaks", "medals"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold transition capitalize ${
                activeTab === tab
                  ? "text-cyan-400 border-b-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="text-center text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <Link
                key={entry.id}
                href={`/profiles/${entry.id}`}
                className="block bg-slate-900 p-4 rounded hover:bg-slate-800 transition border border-slate-800 hover:border-cyan-600"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getMedalColor(entry.premiumTier)} flex items-center justify-center font-bold text-lg`}>
                    {index + 1}
                  </div>

                  {/* User Info */}
                  {entry.avatar ? (
                    <Image
                      src={entry.avatar}
                      alt={entry.username}
                      width={48}
                      height={48}
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                      <span className="font-bold text-cyan-400">{entry.username[0]}</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{entry.username}</span>
                      {entry.clanTag && <span className="text-cyan-400">[{entry.clanTag}]</span>}
                      {entry.premium && (
                        <span className="text-xs bg-amber-900 text-amber-300 px-2 py-1 rounded">
                          {entry.premiumTier}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    {activeTab === "reputation" && (
                      <div className="text-2xl font-bold text-cyan-400">{entry.reputation || 0}</div>
                    )}
                    {activeTab === "streaks" && (
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{entry.corePlusBoostLevel || 0}</div>
                        <div className="text-xs text-slate-400">{entry.corePlusStreakDays || 0} days</div>
                      </div>
                    )}
                    {activeTab === "medals" && (
                      <div className="text-2xl font-bold text-yellow-400">{entry.medalCount || 0}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
