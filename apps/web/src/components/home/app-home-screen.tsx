"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { listForges, listFriends } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const CreateServerModal = dynamic(
  () => import("@/components/modals/create-server-modal").then((mod) => ({ default: mod.CreateServerModal })),
  { loading: () => null }
);

const fallbackServers = [
  { name: "Apex Legion", online: 48, color: "amber" },
  { name: "Nexus", online: 32, color: "indigo" },
  { name: "Outlaw Crew", online: 17, color: "rose" },
  { name: "Nightfall", online: 24, color: "cyan" },
  { name: "Pixel Club", online: 15, color: "emerald" },
];

const fallbackFriends = [
  { name: "ArcticWolf", status: "ONLINE" as const, game: "Valorant" },
  { name: "LunaKnight", status: "IDLE" as const, game: "Apex Legends" },
  { name: "NightHawk", status: "ONLINE" as const, game: "League of Legends" },
  { name: "PixelPirate", status: "DND" as const, game: "Rocket League" },
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

function serverAccent(color?: string) {
  switch (color?.toLowerCase()) {
    case "amber":
      return "bg-amber-500";
    case "rose":
      return "bg-rose-500";
    case "cyan":
      return "bg-cyan-500";
    case "indigo":
      return "bg-indigo-500";
    case "emerald":
      return "bg-emerald-500";
    default:
      return "bg-slate-500";
  }
}

function statusDot(status: "ONLINE" | "IDLE" | "DND" | "OFFLINE") {
  if (status === "ONLINE") return "bg-amber-400";
  if (status === "IDLE") return "bg-amber-400";
  if (status === "DND") return "bg-rose-500";
  return "bg-slate-500";
}

export function AppHomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);

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
    return apiForges.slice(0, 5).map((forge, index) => ({
      name: forge.name,
      online: forge.inviteJoinCount ?? 0,
      color: ["indigo", "amber", "rose", "cyan", "emerald"][index] ?? "slate",
    }));
  }, [forgesQuery.data]);

  const friends = useMemo(() => {
    const apiFriends = (friendsQuery.data?.friends ?? []).filter((friend) => friend.status === "ACCEPTED");
    if (!apiFriends.length) return fallbackFriends;
    return apiFriends.slice(0, 4).map((friend) => {
      const profile = friend.sender.id === user?.id ? friend.receiver : friend.sender;
      return { name: profile.username, status: profile.status, game: profile.game ?? "" };
    });
  }, [friendsQuery.data, user?.id]);

  const onSearch = () => {
    router.push("/search");
  };

  const heroImage = getCustomDesignImageUrl(["app-home-desktop.jpg", "app-home-dashboard-desktop.jpg"], "/home-hero.png");
  const heroImageStyles = (
    <style jsx>{`
      .home-hero-background {
        background-image: url("${heroImage}");
      }
    `}</style>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05030a] pb-28 text-white md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.16),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#ff8a00]/20 via-transparent to-[#38bdf8]/0 blur-3xl" />
        <div className="absolute left-10 top-1/2 h-[320px] w-[320px] rounded-full bg-gradient-to-br from-[#a855f7]/10 via-transparent to-[#facc15]/0 blur-3xl" />
      </div>

      <div className="hidden md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: "Live rooms", value: "12" },
              { label: "Crew online", value: "2.8K" },
              { label: "Sync", value: "100%" },
              { label: "Raids", value: "Active" },
            ].map((item) => (
              <div key={item.label} className="rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
                <span className="block text-[10px] uppercase tracking-[0.24em] text-slate-500">{item.label}</span>
                <span className="mt-1 font-semibold text-white">{item.value}</span>
              </div>
            ))}
          </div>
          <button onClick={onSearch} className="nexus-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
            Open quick panel
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {heroImageStyles}
      <section
          className="relative min-h-[620px] overflow-hidden rounded-[44px] border border-slate-700/70 bg-slate-950/95 shadow-[0_50px_160px_rgba(0,0,0,0.55)] home-hero-background bg-cover bg-center"
          aria-hidden="false"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#05030a]/95 via-[#05030a]/40 to-[#05030a]/95" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.7fr_0.95fr] lg:items-end">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-6"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-amber-200 shadow-[0_12px_30px_rgba(251,191,36,0.14)]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.25)]" />
                Command center live
              </span>
              <div className="flex gap-2 overflow-x-auto pb-2 text-xs text-slate-300 lg:hidden snap-x snap-mandatory scroll-pl-4">
                {[
                  "Arena",
                  "Squad",
                  "Ranked",
                  "Live",
                  "Events",
                ].map((label) => (
                  <button key={label} type="button" className="snap-start whitespace-nowrap rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-900/95">
                    {label}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-2 text-xs tracking-[0.22em] text-slate-300 lg:flex">
                {[
                  "Raids",
                  "Squads",
                  "Events",
                  "Rewards",
                ].map((label) => (
                  <button key={label} type="button" className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-2 transition hover:border-amber-400/50 hover:bg-slate-900/95">
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Live rooms", value: "12" },
                  { label: "Crew online", value: "2.8K" },
                  { label: "Sync status", value: "100%" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.03em] text-white sm:text-6xl">
                Welcome to the most immersive social command experience.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Navigate live audio arenas, raid-ready communities, and hyper-responsive squad workflows with cinematic app polish.
              </p>
              <div className="grid gap-3 overflow-x-auto pb-4 sm:grid-cols-2 sm:overflow-visible sm:pb-0">
                {[
                  "Arena",
                  "Squad",
                  "Ranked",
                  "Live",
                  "Events",
                ].map((label) => (
                  <button
                    type="button"
                    key={label}
                    className="whitespace-nowrap rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-900/95"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => router.push("/app/join")} className="nexus-button-primary rounded-[30px] px-8 py-4 text-sm font-semibold">
                  Enter Live Arena
                </button>
                <button onClick={onSearch} className="nexus-button-secondary rounded-[30px] px-8 py-4 text-sm font-semibold">
                  Search Rooms
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="grid gap-4 rounded-[32px] border border-slate-700/70 bg-slate-900/85 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.32)]"
            >
              <div className="grid gap-3 rounded-[28px] border border-amber-400/20 bg-[#11121a] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Live status</p>
                <p className="text-sm text-slate-300">Your command center is online and ready for crew launches.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Active rooms", value: "12" },
                    { label: "Live users", value: "2.8K" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-3xl bg-slate-950/90 p-4 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-slate-700/70 bg-slate-950/90 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Command quick links</p>
                <div className="mt-4 grid gap-3">
                  {[
                    "Voice Arena",
                    "Community Hubs",
                    "Invite Builder",
                    "Rewards Vault",
                  ].map((item) => (
                    <button key={item} type="button" className="w-full rounded-3xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-900/95">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Featured</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Forge rooms ready to raid</h2>
              </div>
              <Link href="/app/server" className="nexus-button-secondary rounded-3xl px-5 py-3 text-sm font-semibold">
                Explore all
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {servers.slice(0, 6).map((server) => (
                <div
                  key={server.name}
                  className="group relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-amber-400/50"
                >
                  <div className={`absolute inset-x-0 top-0 h-24 ${serverAccent(server.color)} opacity-10`} />
                  <div className="relative flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Live</p>
                      <h3 className="mt-3 text-xl font-semibold text-white">{server.name}</h3>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-100">{server.online} online</span>
                  </div>
                  <div className="relative mt-5 h-40 rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
                    <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(255,184,108,0.18),transparent_35%)]" />
                  </div>
                  <Link
                    href="/app/join"
                    className="relative mt-5 inline-flex items-center justify-center rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25"
                  >
                    Join room
                  </Link>
                </div>
              ))}
            </div>
          </motion.section>

          <aside className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Community pulse</p>
                  <p className="mt-2 text-xl font-semibold text-white">Live metrics</p>
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">Realtime</span>
              </div>
              <div className="mt-6 grid gap-3">
                {[
                  { label: "Views", value: "148K" },
                  { label: "Members", value: "12.4K" },
                  { label: "Activity", value: "+18%" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/90 px-4 py-4 text-sm text-slate-200">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.35)]"
            >
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Next action</p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsCreateServerOpen(true)}
                  className="nexus-button-primary w-full rounded-3xl px-4 py-3 text-sm font-semibold"
                >
                  Create new forge
                </button>
                <button className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold">Invite your crew</button>
              </div>
            </motion.div>
          </aside>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="nexus-panel-glass rounded-[32px] border border-slate-700/70 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Friends</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Online Crew</h3>
              </div>
              <button className="nexus-button-secondary rounded-3xl px-4 py-2 text-sm font-semibold">Manage</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {friends.map((friend) => (
                <div key={friend.name} className="rounded-[28px] border border-slate-700/70 bg-slate-950/90 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-sm font-semibold text-white">{toInitials(friend.name)}</div>
                    <div>
                      <p className="font-semibold text-white">{friend.name}</p>
                      <p className="text-[11px] text-slate-400">{friend.status === "ONLINE" ? "Online" : friend.status === "IDLE" ? "Idle" : "Do Not Disturb"}</p>
                    </div>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDot(friend.status)}`} />
                    {friend.status.toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="nexus-panel-glass rounded-[32px] border border-slate-700/70 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Jump Back In</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Game Lanes Ready</h3>
                </div>
                <button className="nexus-button-secondary rounded-3xl px-4 py-2 text-sm font-semibold">See all</button>
              </div>
              <div className="mt-5 grid gap-3">
                {jumpBackIn.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="flex items-center justify-between rounded-[28px] border border-slate-700/70 bg-slate-950/90 px-4 py-4 text-left transition hover:border-amber-400/60 hover:bg-slate-900/95"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{item.mode}</p>
                    </div>
                    <span className="rounded-full bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">{item.online}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="nexus-panel-glass rounded-[32px] border border-slate-700/70 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
            >
              <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Recommended For You</p>
              <div className="mt-4 grid gap-4 rounded-[28px] border border-slate-700/80 bg-slate-950/90 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">Valorant Central</p>
                    <p className="mt-1 text-sm text-slate-400">8,732 Members • Competitive</p>
                  </div>
                  <button className="nexus-button-primary rounded-3xl px-6 py-3 text-sm font-semibold">Join</button>
                </div>
                <div className="h-28 rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950/50" />
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      <CreateServerModal isOpen={isCreateServerOpen} onClose={() => setIsCreateServerOpen(false)} />

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden px-4 pb-4">
        <div className="mx-auto flex max-w-7xl gap-3 rounded-[28px] border border-slate-700/70 bg-slate-950/95 p-3 shadow-[0_-18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button onClick={() => router.push('/app/join')} className="nexus-button-primary flex-1 rounded-3xl px-4 py-3 text-xs font-semibold">
            Live Arena
          </button>
          <button onClick={onSearch} className="nexus-button-secondary flex-1 rounded-3xl px-4 py-3 text-xs font-semibold">
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
