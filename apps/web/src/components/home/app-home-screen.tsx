"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  Compass,
  Filter,
  Gamepad2,
  Home,
  Plus,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { listForges, listFriends } from "@/lib/api";
import { getProfileBadgesForUser } from "@/lib/brand-badges";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

const fallbackServers = [
  { name: "Apex Legion", online: 48 },
  { name: "Nexus", online: 32 },
  { name: "Outlaw Crew", online: 17 },
  { name: "Nightfall", online: 24 },
  { name: "Pixel Club", online: 15 },
];

const fallbackFriends = [
  { name: "Nova", status: "ONLINE" as const },
  { name: "Zyra", status: "IDLE" as const },
  { name: "Rook", status: "ONLINE" as const },
  { name: "Vex", status: "DND" as const },
];

const jumpBackIn = [
  { title: "Call of Duty", mode: "Squad", online: 4 },
  { title: "Rocket League", mode: "Duo", online: 2 },
  { title: "Minecraft", mode: "Survival", online: 3 },
];

function toInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusToLabel(status: "ONLINE" | "IDLE" | "DND" | "OFFLINE") {
  if (status === "DND") return "Do Not Disturb";
  return `${status.charAt(0)}${status.slice(1).toLowerCase()}`;
}

function statusToDot(status: "ONLINE" | "IDLE" | "DND" | "OFFLINE") {
  if (status === "ONLINE") return "bg-emerald-400";
  if (status === "IDLE") return "bg-amber-400";
  if (status === "DND") return "bg-rose-500";
  return "bg-slate-500";
}

function serverAccent(index: number) {
  const raid = [
    "from-violet-500 to-indigo-700",
    "from-cyan-400 to-blue-700",
    "from-slate-300 to-slate-500",
    "from-fuchsia-500 to-indigo-700",
    "from-pink-400 to-rose-600",
  ];

  return raid[index % raid.length];
}

export function AppHomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [desktopSearchDraft, setDesktopSearchDraft] = useState("");
  const [mobileSearchDraft, setMobileSearchDraft] = useState("");

  const forgesQuery = useQuery({
    queryKey: ["home-forges", accessToken],
    queryFn: () => listForges(accessToken!),
    enabled: Boolean(accessToken),
  });

  const friendsQuery = useQuery({
    queryKey: ["home-friends", accessToken],
    queryFn: () => listFriends(accessToken!),
    enabled: Boolean(accessToken),
  });

  const servers = useMemo(() => {
    const apiForges = forgesQuery.data?.forges ?? [];
    if (!apiForges.length) return fallbackServers;

    return apiForges.slice(0, 5).map((forge) => ({
      name: forge.name,
      online: forge.inviteJoinCount ?? 0,
    }));
  }, [forgesQuery.data]);

  const friends = useMemo(() => {
    const apiFriends = (friendsQuery.data?.friends ?? []).filter((friend) => friend.status === "ACCEPTED");
    if (!apiFriends.length) return fallbackFriends;

    return apiFriends.slice(0, 4).map((friend) => {
      const profile = friend.sender.id === user?.id ? friend.receiver : friend.sender;
      return {
        name: profile.username,
        status: profile.status,
      };
    });
  }, [friendsQuery.data, user?.id]);

  const visibleServers = servers.slice(0, 4);
  const serverTotalOnline = visibleServers.reduce((total, server) => total + server.online, 0);
  const onlineFriends = friends.filter((friend) => friend.status === "ONLINE").length;
  const premiumLabel = user?.premium ? user.premiumTier ?? "CORE" : "NONE";
  const operatorBadges = useMemo(() => {
    if (!user) {
      return [];
    }

    return getProfileBadgesForUser({
      premiumTier: user.premiumTier,
      appRole: user.appRole,
      isAdmin: user.isAdmin,
      corePlusBoostLevel: user.corePlusBoostLevel,
    });
  }, [user]);
  const liveSignal = forgesQuery.isLoading || friendsQuery.isLoading ? "Syncing live data" : "Live signal stable";
  const commandPopulation = serverTotalOnline + onlineFriends;

  const submitSearch = (draft: string) => {
    const query = draft.trim();
    if (!query) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.16),transparent_30%),#030711] text-slate-100">
      <div className="nexus-ambient" aria-hidden="true">
        <div className="nexus-ambient-orb nexus-ambient-orb-a" />
        <div className="nexus-ambient-orb nexus-ambient-orb-b" />
        <div className="nexus-ambient-orb nexus-ambient-orb-c" />
      </div>
      <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />

      {/* Desktop: full-viewport layout */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="relative hidden h-full w-full overflow-hidden p-3 lg:block xl:p-4"
      >
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[1.35fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32, ease: "easeOut", delay: 0.06 }}
            className="grid min-h-0 grid-rows-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-3 overflow-hidden"
          >
            <header className="nexus-panel-strong min-h-0 overflow-hidden rounded-[24px] px-5 py-5">
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-300">NexusForge Command Home</p>
                  <h1 className="mt-2.5 font-[family-name:var(--font-orbitron)] text-3xl font-semibold tracking-tight text-white xl:text-4xl">
                    The actual desktop control surface is live.
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300 xl:text-[15px]">
                    Run community operations, track live player activity, and move between forges without dropping out of the full command surface.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                    <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">{liveSignal}</div>
                    <div className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">{commandPopulation} active across your live command graph</div>
                    <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5">Desktop command priority online</div>
                  </div>
                </div>
                <div className="flex min-w-[240px] flex-col gap-3 text-slate-300">
                  <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Operator</p>
                    <p className="mt-2 text-lg font-semibold text-white">{user?.username ?? "Commander"}</p>
                    <p className="mt-1 text-xs text-slate-400">Tier {premiumLabel} • Boost {user?.corePlusBoostLevel ?? 0}</p>
                    <ProfileBadgeStrip
                      badges={operatorBadges}
                      maxItems={3}
                      containerClassName="mt-3 grid grid-cols-3 gap-2"
                      imageClassName="h-14 w-full"
                      itemClassName="rounded-lg border-slate-700/75"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Link href="/notifications" aria-label="Open notifications" title="Notifications" className="nexus-interactive-btn relative rounded-2xl border border-slate-800 bg-slate-900/70 p-3 hover:border-cyan-500/40">
                      <Bell size={20} />
                      <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    </Link>
                    <Link href="/search" aria-label="Open friends" title="Friends" className="nexus-interactive-btn rounded-2xl border border-slate-800 bg-slate-900/70 p-3 hover:border-cyan-500/40">
                      <Users size={20} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="relative overflow-hidden rounded-[24px] border border-slate-700/70 bg-slate-900/75 shadow-[0_18px_36px_rgba(2,6,23,0.5)]">
                  <div className="relative h-60">
                    <Image src="/brand/boost-pack-icon.png" alt="Featured boost event" fill sizes="(min-width: 1280px) 740px, 100vw" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#070b17]/95 via-[#070b17]/68 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-between p-6">
                      <div>
                        <p className="inline-flex rounded-full border border-indigo-400/35 bg-indigo-500/20 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-indigo-100">
                          FEATURED EVENT
                        </p>
                        <h2 className="mt-3 font-[family-name:var(--font-orbitron)] text-4xl font-semibold leading-[0.9] text-white">
                          RAID
                          <br />
                          TOGETHER
                        </h2>
                        <p className="mt-3 max-w-sm text-sm text-slate-200">
                          Team up, stack boosts, and hit coordinated objectives with your active squad.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href="/core-plus" className="nexus-interactive-btn rounded-2xl border border-indigo-300/25 bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.55)]">
                          Join Now
                        </Link>
                        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                          {liveSignal}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="nexus-panel rounded-[24px] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Session Overview</p>
                        <p className="mt-1 text-sm text-slate-400">Operator telemetry, premium posture, and live command load.</p>
                      </div>
                      <div className="rounded-full border border-cyan-500/25 bg-cyan-950/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                        Stable
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="glass-cut rounded-2xl border border-slate-800/80 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Premium Tier</p>
                        <p className="mt-1.5 text-xl font-semibold text-white">{premiumLabel}</p>
                        <ProfileBadgeStrip
                          badges={operatorBadges}
                          maxItems={2}
                          containerClassName="mt-2"
                          imageClassName="h-8 w-8"
                        />
                      </div>
                      <div className="glass-cut rounded-2xl border border-slate-800/80 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Boost Level</p>
                        <p className="mt-1.5 text-xl font-semibold text-cyan-100">{user?.corePlusBoostLevel ?? 0}</p>
                      </div>
                      <div className="glass-cut rounded-2xl border border-slate-800/80 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Servers Active</p>
                        <p className="mt-1.5 text-xl font-semibold text-emerald-100">{visibleServers.length}</p>
                      </div>
                      <div className="glass-cut rounded-2xl border border-slate-800/80 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Friends Online</p>
                        <p className="mt-1.5 text-xl font-semibold text-amber-100">{onlineFriends}</p>
                      </div>
                    </div>
                  </div>

                  <div className="nexus-panel rounded-[24px] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Command Search</p>
                        <p className="mt-1 text-sm text-slate-400">Jump directly into players, raids, active lobbies, and forge surfaces.</p>
                      </div>
                      <div className="rounded-full border border-slate-800 bg-slate-950/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        Live query
                      </div>
                    </div>
                    <form
                      className="flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/55 px-4 py-3 text-slate-400"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitSearch(desktopSearchDraft);
                      }}
                    >
                      <Search size={18} />
                      <input
                        value={desktopSearchDraft}
                        onChange={(event) => setDesktopSearchDraft(event.target.value)}
                        placeholder="Search for servers, players, raids, and current lobbies..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      />
                      <button type="submit" className="nexus-interactive-btn rounded-xl border border-cyan-500/30 bg-cyan-950/25 px-3 py-2 text-xs font-semibold text-cyan-100">
                        Search
                      </button>
                      <Link href="/search" aria-label="Open search filters" title="Filters" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-900/65 text-slate-300">
                        <Filter size={18} />
                      </Link>
                    </form>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 gap-3 overflow-hidden xl:grid-cols-[1fr_0.95fr]">
              <section className="nexus-panel flex min-h-0 flex-col overflow-hidden rounded-[24px] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Your Servers</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">Live forge roster</h3>
                  </div>
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs text-emerald-100">
                    {serverTotalOnline} online total
                  </div>
                </div>
                <div className="grid min-h-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {servers.map((server, index) => (
                    <article key={server.name} className="nexus-interactive-card relative overflow-hidden rounded-[22px] border border-slate-800 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.18))] p-3">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent" />
                      <div className={cn("mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-semibold text-slate-50", serverAccent(index))}>
                        {toInitials(server.name)}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-100">{server.name}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Forge signal</span>
                        <span className="text-emerald-400">{server.online} Online</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="nexus-panel flex min-h-0 flex-col overflow-hidden rounded-[24px] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Friends</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">Active squad roster</h3>
                  </div>
                  <Link href="/search" className="text-sm font-medium text-indigo-400">See All</Link>
                </div>
                <div className="grid min-h-0 gap-2">
                  {friends.map((friend) => (
                    <article key={friend.name} className="nexus-interactive-card flex items-center gap-3 rounded-[22px] border border-slate-800 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(30,41,59,0.82))] px-3 py-3">
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-100">
                        {toInitials(friend.name)}
                        <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border border-[#030711]", statusToDot(friend.status))} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{friend.name}</p>
                        <p className="truncate text-xs text-slate-400">{statusToLabel(friend.status)}</p>
                      </div>
                      <div className="rounded-full border border-slate-700/80 bg-slate-950/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Ready</div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32, ease: "easeOut", delay: 0.1 }}
            className="grid min-h-0 gap-3 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden"
          >
            <section className="nexus-panel min-h-0 overflow-hidden rounded-[24px] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Jump Back In</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Recent activity lanes</h3>
                </div>
                <Link href="/leaderboards" className="text-sm font-medium text-indigo-400">See All</Link>
              </div>
              <div className="mt-3 grid gap-2">
                {jumpBackIn.map((item) => (
                  <article key={item.title} className="nexus-interactive-card overflow-hidden rounded-[22px] border border-slate-800 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(49,46,129,0.3))]">
                    <div className="h-9 bg-gradient-to-r from-slate-700 via-indigo-700 to-slate-900" />
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                        <span>{item.mode}</span>
                        <span className="text-emerald-400">{item.online} Online</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="nexus-panel rounded-[24px] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Recommended</p>
              <article className="nexus-interactive-card mt-4 flex items-center justify-between gap-3 rounded-[22px] border border-slate-700 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.18))] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                    <Image src="/brand/nexusforge-logo.png" alt="Recommendation" width={48} height={48} className="h-12 w-12 object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">Valorant Central</p>
                    <p className="truncate text-xs text-slate-400">8,732 Members • Competitive</p>
                  </div>
                </div>
                <Link href="/search" className="nexus-interactive-btn rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Join</Link>
              </article>
            </section>

            <section className="nexus-panel rounded-[24px] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Quick Actions</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Link href="/settings?intent=create-forge" className="nexus-interactive-btn flex items-center justify-between rounded-[22px] border border-slate-700/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.18))] px-4 py-3 text-left text-slate-200 hover:border-cyan-500/40">
                  <span>Create Forge</span>
                  <Plus size={16} />
                </Link>
                <Link href="/search?q=games" className="nexus-interactive-btn flex items-center justify-between rounded-[22px] border border-slate-700/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.18))] px-4 py-3 text-left text-slate-200 hover:border-cyan-500/40">
                  <span>Explore Games</span>
                  <Gamepad2 size={16} />
                </Link>
                <Link href="/notifications?filter=activity" className="nexus-interactive-btn flex items-center justify-between rounded-[22px] border border-slate-700/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.18))] px-4 py-3 text-left text-slate-200 hover:border-cyan-500/40">
                  <span>Browse Activity</span>
                  <Zap size={16} />
                </Link>
              </div>
            </section>
          </motion.aside>
        </div>
      </motion.div>

      {/* Mobile: full-screen flex column, no scrolling */}
      <div className="flex h-full flex-col overflow-hidden px-4 pb-[72px] pt-3 lg:hidden">

        {/* Header */}
        <header className="mb-2 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden rounded-full border border-slate-700/80 bg-slate-900">
              <Image src="/brand/nexusforge-main-logo.png" alt="Profile" width={44} height={44} className="h-11 w-11 object-cover" />
              <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#030711] bg-emerald-400" />
            </div>
            <h1 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold tracking-tight text-white">Home</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Link href="/notifications" aria-label="Open notifications" className="nexus-interactive-btn relative rounded-xl border border-slate-800 bg-slate-900/65 p-2">
              <Bell size={17} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-indigo-500" />
            </Link>
            <Link href="/search" aria-label="Open friends" className="nexus-interactive-btn rounded-xl border border-slate-800 bg-slate-900/65 p-2">
              <Users size={17} />
            </Link>
          </div>
        </header>

        {/* Search */}
        <form
          className="mb-2.5 flex shrink-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(mobileSearchDraft);
          }}
        >
          <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/65 px-3 text-slate-400">
            <Search size={16} />
            <input
              value={mobileSearchDraft}
              onChange={(event) => setMobileSearchDraft(event.target.value)}
              placeholder="Search for servers, friends, games..."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="nexus-interactive-btn grid h-10 place-items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-3 text-xs font-semibold text-cyan-100">
            Go
          </button>
          <Link href="/search" aria-label="Open search filters" className="nexus-interactive-btn grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-900/65 text-slate-300">
            <Filter size={16} />
          </Link>
        </form>

        {/* Hero event — proportional height */}
        <section className="relative mb-2 shrink-0 h-[32%] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/75 shadow-[0_12px_28px_rgba(2,6,23,0.5)]">
          <Image src="/brand/boost-pack-icon.png" alt="Featured boost event" fill sizes="(max-width: 640px) 100vw, 448px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070b17]/95 via-[#070b17]/65 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            <div>
              <p className="mb-1 inline-flex rounded-md bg-indigo-500/80 px-2 py-0.5 text-[9px] font-semibold tracking-wide">FEATURED EVENT</p>
              <h2 className="text-2xl font-bold leading-[0.92] text-white">
                RAID
                <br />
                TOGETHER
              </h2>
              <p className="mt-1 max-w-[180px] text-sm text-slate-200">Team up. Take down epic challenges.</p>
            </div>
            <Link
              href="/core-plus"
              className="nexus-interactive-btn inline-flex self-start rounded-xl border border-indigo-300/25 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.5)]"
            >
              Join Now
            </Link>
          </div>
        </section>

        {/* Servers */}
        <section className="mb-2 shrink-0">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Your Servers</h3>
            <Link href="/search" className="text-xs font-medium text-indigo-400">See All</Link>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {visibleServers.map((server, index) => (
              <article key={server.name} className="nexus-interactive-card rounded-xl border border-slate-800 bg-slate-900/70 p-1.5">
                <div className={cn("mb-1 flex h-9 items-center justify-center rounded-lg bg-gradient-to-br", serverAccent(index))}>
                  <span className="text-[10px] font-semibold text-slate-50">{toInitials(server.name)}</span>
                </div>
                <p className="truncate text-[10px] font-medium text-slate-100">{server.name}</p>
                <p className="text-[9px] text-emerald-400">{server.online} Online</p>
              </article>
            ))}
            <article className="grid place-items-center rounded-xl border border-slate-800 bg-slate-900/65 p-1.5 text-slate-300">
              <Plus size={14} />
              <p className="mt-0.5 text-[10px]">Add</p>
            </article>
          </div>
        </section>

        {/* Friends — fills remaining space */}
        <section className="min-h-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Friends</h3>
            <Link href="/leaderboards" className="text-xs font-medium text-indigo-400">See All</Link>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {friends.map((friend) => (
              <article key={friend.name} className="nexus-interactive-card rounded-xl border border-slate-800 bg-slate-900/70 p-1.5">
                <div className="relative mb-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-100">
                  {toInitials(friend.name)}
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#030711] ${statusToDot(friend.status)}`} />
                </div>
                <p className="truncate text-[10px] font-medium text-slate-100">{friend.name}</p>
                <p className="truncate text-[9px] text-slate-400">{statusToLabel(friend.status)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-3 left-1/2 z-40 flex w-[min(94vw,480px)] -translate-x-1/2 items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/88 px-4 py-2 text-slate-400 backdrop-blur-xl lg:hidden">
        <Link href="/app" className="flex flex-col items-center gap-1 text-indigo-400">
          <Home size={18} />
          <span className="text-xs">Home</span>
        </Link>
        <Link href="/search?q=games" className="flex flex-col items-center gap-1">
          <Gamepad2 size={18} />
          <span className="text-xs">Games</span>
        </Link>
        <Link href="/search" className="flex flex-col items-center gap-1">
          <Compass size={18} />
          <span className="text-xs">Explore</span>
        </Link>
        <Link href="/notifications?filter=activity" className="flex flex-col items-center gap-1">
          <Zap size={18} />
          <span className="text-xs">Activity</span>
        </Link>
        <Link href="/settings" aria-label="Open profile" title="Profile" className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-700">
          <Image src="/brand/nexusforge-main-logo.png" alt="Profile" width={32} height={32} className="h-8 w-8 object-cover" />
        </Link>
      </nav>
    </div>
  );
}
