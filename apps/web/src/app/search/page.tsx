"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getUserGroups, searchProfiles, User } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";

type SearchGroup = {
  tag: string;
  name: string;
  description?: string;
  totalUsers: number;
  onlineUsers: number;
  premiumUsers?: number;
  avgReputation?: number;
  sampleUsers?: Array<{
    id: string;
    username: string;
    status: User["status"];
    premiumTier?: User["premiumTier"];
    reputation: number;
  }>;
};

const fallbackGroups: SearchGroup[] = [
  {
    tag: "CAS",
    name: "Casual Crew",
    description: "Low-pressure players who jump in for quick matches, chat, and social sessions.",
    totalUsers: 5,
    onlineUsers: 2,
    premiumUsers: 3,
    avgReputation: 116,
    sampleUsers: [
      { id: "cas-1", username: "lunaplay", status: "ONLINE", premiumTier: "CORE", reputation: 118 },
      { id: "cas-2", username: "pixelmuse", status: "ONLINE", premiumTier: "CORE", reputation: 156 },
      { id: "cas-3", username: "novaquest", status: "IDLE", premiumTier: "NONE", reputation: 92 },
    ],
  },
  {
    tag: "CRT",
    name: "Creator Circle",
    description: "Streamers, editors, and clip makers who keep the feed moving.",
    totalUsers: 5,
    onlineUsers: 3,
    premiumUsers: 5,
    avgReputation: 359,
    sampleUsers: [
      { id: "crt-1", username: "ariaframe", status: "ONLINE", premiumTier: "PLUS", reputation: 364 },
      { id: "crt-2", username: "bloomcast", status: "ONLINE", premiumTier: "PLUS", reputation: 340 },
      { id: "crt-3", username: "remicuts", status: "ONLINE", premiumTier: "CORE", reputation: 278 },
    ],
  },
  {
    tag: "COMP",
    name: "Competitive League",
    description: "Ranked players, scrim leaders, and tournament regulars.",
    totalUsers: 5,
    onlineUsers: 3,
    premiumUsers: 5,
    avgReputation: 605,
    sampleUsers: [
      { id: "comp-1", username: "kaderush", status: "ONLINE", premiumTier: "ELITE", reputation: 731 },
      { id: "comp-2", username: "boltsync", status: "ONLINE", premiumTier: "PLUS", reputation: 642 },
      { id: "comp-3", username: "hexstrike", status: "IDLE", premiumTier: "ELITE", reputation: 904 },
    ],
  },
  {
    tag: "OPS",
    name: "Ops Team",
    description: "Moderators, admins, and owner-level operators.",
    totalUsers: 5,
    onlineUsers: 3,
    premiumUsers: 5,
    avgReputation: 2948,
    sampleUsers: [
      { id: "ops-1", username: "atlasops", status: "ONLINE", premiumTier: "INFINITE", reputation: 5000 },
      { id: "ops-2", username: "quinncore", status: "ONLINE", premiumTier: "INFINITE", reputation: 3180 },
      { id: "ops-3", username: "seraforge", status: "ONLINE", premiumTier: "ELITE", reputation: 2610 },
    ],
  },
];

function SearchContent() {
  type SearchProfileUser = Pick<User, "id" | "username" | "avatar" | "premium" | "createdAt"> & {
    clanTag?: string | null;
    premiumTier: string;
    reputation: number;
  };

  const { user: currentUser, accessToken } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchProfileUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<SearchGroup[]>(fallbackGroups);
  const premiumResults = results.filter((profile) => profile.premium).length;
  const highestReputation = results.reduce((highest, profile) => Math.max(highest, profile.reputation), 0);
  const activeGroup = groups.find((group) => group.tag.toLowerCase() === searchQuery.trim().toLowerCase());

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    if (!currentUser || !accessToken) {
      router.push("/login");
      return;
    }
  }, [currentUser, accessToken, router]);

  useEffect(() => {
    const loadGroups = async () => {
      if (!accessToken) return;

      try {
        const data = await getUserGroups(accessToken);
        setGroups(data.groups.map((group) => ({
          tag: group.tag,
          name: group.name,
          description: group.description,
          totalUsers: group.totalUsers,
          onlineUsers: group.onlineUsers,
          premiumUsers: group.premiumUsers,
          avgReputation: group.avgReputation,
          sampleUsers: group.sampleUsers,
        })));
      } catch (error) {
        console.error("Failed to load user groups:", error);
        setGroups(fallbackGroups);
      }
    };

    void loadGroups();
  }, [accessToken]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || !accessToken) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await searchProfiles(accessToken, searchQuery, 50, 0);
        setResults(data.users);
        setTotal(data.total);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, accessToken]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <ExperienceShell
      eyebrow="Discovery"
      title="Search Users"
      subtitle="Find players, clan identities, and high-reputation profiles without leaving the command surface."
      metrics={[
        { label: "Query", value: searchQuery.trim() ? "Active" : "Idle", tone: searchQuery.trim() ? "cyan" : "slate" },
        { label: "Results", value: String(total), tone: "emerald" },
        { label: "Status", value: loading ? "Scanning" : "Ready", tone: loading ? "amber" : "cyan" },
      ]}
      actions={[
        { label: "Back to App", href: "/app", tone: "ghost" },
        { label: "Open Notifications", href: "/notifications", tone: "primary" },
      ]}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="nexus-display-panel relative overflow-hidden rounded-[28px] p-5">
          <div className="nexus-ambient" aria-hidden="true">
            <div className="nexus-ambient-orb nexus-ambient-orb-a" />
            <div className="nexus-ambient-orb nexus-ambient-orb-c" />
          </div>
          <div className="relative space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Discovery Matrix</p>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Scan usernames, clan identities, and reputation signals from a single live query rail.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {groups.map((group) => (
                <button
                  key={group.tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(group.tag);
                    router.replace(`/search?q=${encodeURIComponent(group.tag)}`);
                  }}
                  className={`nexus-interactive-card rounded-2xl border px-3 py-3 text-left ${
                    activeGroup?.tag === group.tag
                      ? "border-cyan-500/65 bg-[linear-gradient(145deg,rgba(8,47,73,0.3),rgba(15,23,42,0.98))]"
                      : "border-slate-800 bg-[linear-gradient(145deg,rgba(8,47,73,0.18),rgba(15,23,42,0.92))]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">[{group.tag}]</p>
                  <p className="mt-1 text-sm font-semibold text-white">{group.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{group.totalUsers} users · {group.onlineUsers} online</p>
                </button>
              ))}
            </div>

            {activeGroup ? (
              <div className="rounded-2xl border border-cyan-500/35 bg-cyan-950/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Active Cohort [{activeGroup.tag}]</p>
                    <p className="mt-1 text-sm font-semibold text-white">{activeGroup.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{activeGroup.description ?? "Cohort view enabled."}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      router.replace("/search");
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200"
                  >
                    Clear filter
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{activeGroup.totalUsers} users</span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-emerald-300">{activeGroup.onlineUsers} online</span>
                  {typeof activeGroup.premiumUsers === "number" ? <span className="rounded-full border border-slate-700 px-2 py-1 text-amber-300">{activeGroup.premiumUsers} premium</span> : null}
                  {typeof activeGroup.avgReputation === "number" ? <span className="rounded-full border border-slate-700 px-2 py-1 text-cyan-200">avg rep {activeGroup.avgReputation}</span> : null}
                </div>
                {activeGroup.sampleUsers && activeGroup.sampleUsers.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {activeGroup.sampleUsers.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-100">{member.username}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{member.premiumTier ?? "NONE"} · {member.reputation} rep</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
              <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.197 5.197a7.5 7.5 0 0 0 10.606 10.606Z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search by username or clan tag..."
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/70 py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] transition focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="nexus-metric-card rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Matched Profiles</p>
            <p className="mt-1 text-xl font-semibold text-cyan-300">{total}</p>
          </div>
          <div className="nexus-metric-card rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Premium Hits</p>
            <p className="mt-1 text-xl font-semibold text-amber-300">{premiumResults}</p>
          </div>
          <div className="nexus-metric-card rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Peak Reputation</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{highestReputation}</p>
          </div>
        </div>

        {loading ? (
          <div className="nexus-display-panel rounded-[24px] p-5 text-center text-sm text-slate-400">Searching...</div>
        ) : null}

        {!loading && searchQuery && results.length === 0 ? (
          <div className="nexus-display-panel rounded-[24px] p-8 text-center">
            <p className="text-sm font-medium text-slate-300">No results for &ldquo;{searchQuery}&rdquo;</p>
            <p className="mt-1 text-xs text-slate-500">Try a different username or clan tag</p>
          </div>
        ) : null}

        {!loading && !searchQuery ? (
          <div className="nexus-display-panel rounded-[24px] p-8 text-center">
            <p className="text-sm text-slate-400">Start typing to discover players</p>
          </div>
        ) : null}

        {!loading && results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{total} result{total !== 1 ? "s" : ""}</p>
            {results.map((user) => {
              const rowBadges = getProfileBadgesForUser({
                premiumTier: (user.premiumTier as "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE" | undefined) ?? "NONE",
                appRole: undefined,
                isAdmin: false,
                corePlusBoostLevel: undefined,
              });

              return (
              <Link
                key={user.id}
                href={`/profiles/${user.id}`}
                className="nexus-interactive-card relative flex items-center gap-4 overflow-hidden rounded-[24px] border border-slate-800 bg-[linear-gradient(145deg,rgba(8,47,73,0.16),rgba(15,23,42,0.9))] px-4 py-4"
              >
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 via-cyan-500 to-blue-600" />
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.username}
                    width={44}
                    height={44}
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-base font-bold text-slate-300">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Profile</span>
                    {user.premium ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{user.premiumTier}</span>
                    ) : null}
                  </div>
                  <ProfileBadgeStrip badges={rowBadges} containerClassName="mb-2" />
                  <p className="truncate text-sm font-semibold text-slate-100">{user.username}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {user.clanTag ? <p className="truncate text-cyan-400">[{user.clanTag}]</p> : null}
                    <span className="text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reputation</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">{user.reputation} rep</p>
                </div>
              </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </ExperienceShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="nexus-shell flex items-center justify-center text-slate-400">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
