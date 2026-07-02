"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getUserGroups, searchProfiles, User } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Sparkles, Play, Users } from "lucide-react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { DynamicBackground } from "@/components/ui/dynamic-background";
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
  const query = searchParams?.get("q") || "";
  const isSignedIn = Boolean(currentUser && accessToken);
  const loginRedirect = `/login?redirect=${encodeURIComponent(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`)}`;

  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchProfileUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<SearchGroup[]>(fallbackGroups);
  const premiumResults = results.filter((profile) => profile.premium).length;
  const highestReputation = results.reduce((highest, profile) => Math.max(highest, profile.reputation), 0);
  const activeGroup = groups.find((group) => group.tag.toLowerCase() === searchQuery.trim().toLowerCase());
  const heroImage = getCustomDesignImageUrl(["app-search-desktop.jpg"], "/home-hero.png");

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    if (!accessToken) {
      setGroups(fallbackGroups);
      setResults([]);
      setTotal(0);
    }
  }, [accessToken]);

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
    <div className="relative min-h-screen overflow-hidden bg-[#f5f1ea] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(56,189,248,0.08),transparent_40%)]" />

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <DynamicBackground
            url={heroImage}
            className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 shadow-[0_24px_60px_rgba(15,23,42,0.08)] bg-cover bg-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#f5f1ea]/92 via-[#f5f1ea]/22 to-[#f5f1ea]/92" />
            <div className="absolute inset-0 bg-white/35" />
            <div className="relative p-6 text-slate-900">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-700">Search design</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">Discover live listening hubs with the custom search UI.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">This page now reflects your new app visuals while you search live rooms, audio communities, and shared listening sessions.</p>
            </div>
          </DynamicBackground>

          <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.32em] text-amber-700">Discover</p>
            <p className="text-lg font-semibold text-slate-950">Listening Hub</p>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Listening hubs</p>
            {groups.map((group) => (
              <button
                key={group.tag}
                type="button"
                onClick={() => {
                  setSearchQuery(group.tag);
                  router.replace(`/search?q=${encodeURIComponent(group.tag)}`);
                }}
                className={`w-full rounded-[22px] border px-4 py-3 text-left text-sm transition ${
                  activeGroup?.tag === group.tag
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-900/10 bg-white/85 text-slate-700 hover:border-amber-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{group.name}</span>
                  <span className="text-xs text-slate-400">{group.tag}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{group.onlineUsers} online</p>
              </button>
            ))}
          </div>

            <div className="mt-6 rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Quick Actions</p>
            <div className="mt-4 space-y-3">
              <button className="nexus-button-secondary w-full rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900">Featured</button>
              <button className="nexus-button-secondary w-full rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900">New rooms</button>
              <button className="nexus-button-secondary w-full rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900">Top raids</button>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-700">Discover Listenings</p>
                <h1 className="mt-2 text-4xl font-semibold text-slate-950 sm:text-5xl">Find the next community listening room.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Browse immersive audio spaces, social listening lounges, and active community events built for shared sound.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[300px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearch}
                    placeholder="Search servers, tags, live rooms..."
                    className="h-14 w-full rounded-[22px] border border-slate-900/10 bg-white px-12 text-sm text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => router.replace(`/search?q=${encodeURIComponent(searchQuery.trim())}`)}
                  className="nexus-button-primary inline-flex h-14 items-center justify-center rounded-full px-6 text-sm font-semibold"
                  disabled={!searchQuery.trim() || loading}
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Premium profiles</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{premiumResults}</p>
              </div>
              <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Top reputation</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{highestReputation}</p>
              </div>
              <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Search state</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? "Searching" : "Ready"}</p>
              </div>
            </div>
          </section>

          {!isSignedIn && (
            <GuestAuthCallout
              title="Sign in to unlock the live search experience."
              description="Beta testers and members can search active rooms, join communities, and save their query state across devices."
              loginHref={loginRedirect}
              registerHref="/register?redirect=/search"
            />
          )}

          <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">Featured</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Live Server Picks</h2>
                  </div>
                  <button className="rounded-full border border-slate-900/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-900">View all</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groups.slice(0, 6).map((group) => (
                    <div key={group.tag} className="group relative overflow-hidden rounded-[24px] border border-slate-900/10 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-amber-300 hover:bg-white">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{group.tag}</p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-950">{group.name}</h3>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-700">{group.onlineUsers} live</span>
                      </div>
                      <div className="h-36 rounded-[20px] bg-gradient-to-br from-slate-50 via-slate-100 to-white" />
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="space-y-1 text-xs text-slate-600">
                          <p>{group.totalUsers} members</p>
                          <p>{group.sampleUsers?.length ?? 0} hosts</p>
                        </div>
                        <button className="rounded-full border border-slate-900/10 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {results.length > 0 && (
                <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">Search Results</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Profiles found</h2>
                    </div>
                    <span className="rounded-full border border-slate-900/10 bg-slate-50 px-3 py-2 text-xs text-slate-600">{total} results</span>
                  </div>
                  <div className="grid gap-3">
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
                          className="relative flex items-center gap-4 overflow-hidden rounded-[24px] border border-slate-900/10 bg-white/85 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
                        >
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 via-amber-500 to-rose-600" />
                          {user.avatar ? (
                            <Image
                              src={user.avatar}
                              alt={user.username}
                              width={44}
                              height={44}
                              className="rounded-full object-cover aspect-square"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-900/10 bg-slate-100 text-base font-bold text-slate-700">
                              {user.username[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Profile</span>
                              {user.premium ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{user.premiumTier}</span>
                              ) : null}
                            </div>
                            <ProfileBadgeStrip badges={rowBadges} containerClassName="mb-2" />
                            <p className="truncate text-sm font-semibold text-slate-950">{user.username}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              {user.clanTag ? <p className="truncate text-amber-700">[{user.clanTag}]</p> : null}
                              <span className="text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-[20px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-right">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reputation</p>
                            <p className="mt-1 text-sm font-semibold text-amber-700">{user.reputation} rep</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Hot Picks</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">AI-driven recommendations</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div className="mt-4 space-y-3">
                  {groups.slice(0, 3).map((group) => (
                    <div key={group.tag} className="rounded-[22px] border border-slate-900/10 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{group.name}</p>
                      <p className="mt-1 text-sm text-slate-700">{group.onlineUsers} live · {group.totalUsers} members</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Launch Control</p>
                <button className="mt-4 flex w-full items-center justify-between rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                  <span>Live mission</span>
                  <Play className="h-4 w-4 text-amber-500" />
                </button>
                <button className="mt-3 flex w-full items-center justify-between rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                  <span>Members feed</span>
                  <Users className="h-4 w-4 text-amber-500" />
                </button>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="nexus-shell flex items-center justify-center text-slate-400">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}

