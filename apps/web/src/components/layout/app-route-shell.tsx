"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { appServerLinks } from "@/lib/app-servers";
import { AppLeftDock } from "@/components/layout/app-left-dock";
import { useAuthStore } from "@/store/auth-store";
import { Activity, Award, Bell, CloudDownload, Gamepad, Gift, Heart, Home, Layers, Search, Sparkles, User, Users } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Community", href: "/app/server", icon: Layers },
  { label: "Listen", href: "/app/friends", icon: Users },
  { label: "Games", href: "/app/games", icon: Gamepad },
  { label: "Explore", href: "/search", icon: Sparkles },
  { label: "Activity", href: "/app/activity", icon: Activity },
  { label: "Rewards", href: "/app/rewards", icon: Gift },
  { label: "Downloads", href: "/app/downloads", icon: CloudDownload },
  { label: "Notifications", href: "/app/notifications", icon: Bell },
  { label: "Profile", href: "/app/profile", icon: User },
  { label: "Settings", href: "/app/settings", icon: Heart },
];

const libraryItems = [
  { label: "My Games", icon: Gamepad },
  { label: "Installed", icon: Award },
  { label: "Favorites", icon: Heart },
];

const quickLaunch = [
  { label: "Valorant", icon: Sparkles },
  { label: "Apex Legends", icon: Activity },
  { label: "Fortnite", icon: Bell },
  { label: "Minecraft", icon: Users },
];

const statusItems = [
  { label: "Live invites", value: "12", tone: "text-amber-300" },
  { label: "Voice rooms", value: "4", tone: "text-rose-300" },
  { label: "Active squads", value: "18", tone: "text-slate-100" },
];

const channelList = [
  { label: "general", description: "Main command stream", href: "/app" },
  { label: "raid-planning", description: "Team strategy and timing", href: "/app/server" },
  { label: "voice-stage", description: "Live audio rooms and stage", href: "/app/voice" },
  { label: "events", description: "Scheduled launches and drops", href: "/app/activity" },
  { label: "rewards", description: "Loot, badges, and boosts", href: "/app/rewards" },
];

function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/app" && pathname?.startsWith(href));
}

const routeMeta = [
  {
    match: (pathname: string) => pathname === "/app",
    breadcrumb: "App > Home",
    title: "Home dashboard",
    subtitle: "Navigate your command center, live status, and fast access to every club and room.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/server"),
    breadcrumb: "App > Community",
    title: "Community hubs",
    subtitle: "Join listening groups, discover shared spaces, and manage active social lounges.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/friends"),
    breadcrumb: "App > Listen",
    title: "Listen network",
    subtitle: "Find live listeners, audience sessions, and shared audio rooms.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/games"),
    breadcrumb: "App > Games",
    title: "Game hubs",
    subtitle: "Launch into trending arenas and discover your next match.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/search"),
    breadcrumb: "App > Explore",
    title: "Explore hubs",
    subtitle: "Search servers, communities, and live events across NexusForge.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/activity"),
    breadcrumb: "App > Activity",
    title: "Activity feed",
    subtitle: "Review live squad updates, event launches, and system alerts.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/rewards"),
    breadcrumb: "App > Rewards",
    title: "Rewards vault",
    subtitle: "Redeem XP, badges, and premium perks for your command profile.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/downloads"),
    breadcrumb: "App > Downloads",
    title: "Downloads library",
    subtitle: "Manage your installed content, updates, and launcher assets.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/notifications"),
    breadcrumb: "App > Notifications",
    title: "Alert center",
    subtitle: "Review system alerts, squad pings, and live event notices.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/profile"),
    breadcrumb: "App > Profile",
    title: "Commander profile",
    subtitle: "Customize your account, avatar, and account identity settings.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/settings"),
    breadcrumb: "App > Settings",
    title: "Command settings",
    subtitle: "Configure your account, privacy, and app preferences.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/voice"),
    breadcrumb: "App > Voice",
    title: "Voice arena",
    subtitle: "Control live audio rooms, spatial stage presence, and squad comms.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/join"),
    breadcrumb: "App > Join",
    title: "Join a server",
    subtitle: "Paste an invite link or code to connect with your crew.",
  },
];

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const { accessToken, user, clearSession } = useAuthStore();
  const isSignedIn = Boolean(accessToken && user);
  const loginRedirect = `/login?redirect=${encodeURIComponent(pathname)}`;

  const routeInfo = useMemo(
    () => routeMeta.find((route) => route.match(pathname)) ?? routeMeta[0],
    [pathname]
  );

  const routeBackground = getCustomDesignImageUrl(
    [
      pathname === "/app" ? "app-home-desktop.jpg" : "",
      pathname.startsWith("/app/server") ? "app-server-desktop.jpg" : "",
      pathname.startsWith("/app/voice") ? "app-voice-stage-desktop.jpg" : "",
      pathname.startsWith("/app/join") ? "app-join-desktop.jpg" : "",
      pathname.startsWith("/app/friends") ? "app-friends-desktop.jpg" : "",
      pathname.startsWith("/app/games") ? "app-games-desktop.jpg" : "",
      pathname.startsWith("/app/activity") ? "app-activity-desktop.jpg" : "",
      pathname.startsWith("/app/rewards") ? "app-rewards-desktop.jpg" : "",
      pathname.startsWith("/app/downloads") ? "app-downloads-desktop.jpg" : "",
      pathname.startsWith("/app/notifications") ? "app-notifications-desktop.jpg" : "",
      pathname.startsWith("/app/profile") ? "app-profile-desktop.jpg" : "",
      pathname.startsWith("/app/settings") ? "app-settings-desktop.jpg" : "",
      pathname.startsWith("/search") ? "app-search-desktop.jpg" : "",
      pathname === "/support" ? "app-support-desktop.jpg" : "",
    ],
    "/app-hero.png"
  );

  const routeBackgroundStyles = routeBackground ? (
    <style jsx>{`
      .route-background {
        background-image: url("${routeBackground}");
      }
    `}</style>
  ) : null;

  return (
    <div className="relative min-h-screen h-screen overflow-hidden bg-[#09040b] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(203,46,53,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(255,184,108,0.12),transparent_42%)]" />
      {routeBackground ? (
        <>
          {routeBackgroundStyles}
          <div
            className="pointer-events-none absolute inset-0 -z-10 h-screen w-screen overflow-hidden opacity-40 bg-center bg-cover route-background"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[#09040b]/80" />
          </div>
        </>
      ) : null}
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[72px_320px_minmax(0,1.1fr)_0.95fr]">
        <AppLeftDock className="hidden xl:flex flex-col items-center gap-4 rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-4 shadow-[0_35px_100px_rgba(0,0,0,0.24)]" />
        <aside className="sticky top-6 self-start rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_35px_100px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-950/90 shadow-[0_0_28px_rgba(251,191,36,0.28)]">
                <Image src="/brand/nexusforge-main-logo.png" alt="NexusForge" fill sizes="4rem" className="object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300">NEXUSFORGE</p>
                <p className="text-lg font-semibold text-white">Command Center</p>
              </div>
            </div>
            <button className="nexus-interactive-btn flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/85 px-4 py-3 text-sm text-slate-200 transition hover:border-amber-400/70 hover:bg-[#171114]">
              <Search className="h-4 w-4 text-amber-300" />
              <span>Ctrl + K</span>
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 xl:hidden">
            {appServerLinks.map((icon) => (
              <Link
                key={icon.href}
                href={icon.href}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold transition duration-200 ${
                  isActive(pathname, icon.href)
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-100 shadow-[0_12px_30px_rgba(251,191,36,0.16)]"
                    : "border-slate-700/70 bg-slate-950/80 text-slate-200 hover:border-slate-600/90 hover:bg-slate-900/95"
                }`}
                title={icon.title}
              >
                {icon.label}
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Workspace</p>
                <p className="mt-2 text-sm font-semibold text-white">Nexus Central</p>
              </div>
              <span className="rounded-2xl bg-amber-500/10 px-2 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">Online</span>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { label: "#general", href: "/app", active: pathname === "/app" },
                { label: "#strategy", href: "/app/server", active: pathname.startsWith("/app/server") },
                { label: "🎧 live-stage", href: "/app/voice", active: pathname.startsWith("/app/voice") },
                { label: "🎮 game-lobby", href: "/app/games", active: pathname.startsWith("/app/games") },
              ].map((channel) => (
                <Link
                  key={channel.label}
                  href={channel.href}
                  className={`block w-full rounded-3xl border px-4 py-3 text-left text-sm font-medium transition ${
                    channel.active
                      ? "border-amber-400/70 bg-amber-500/10 text-amber-100 shadow-[0_10px_28px_rgba(251,191,36,0.1)]"
                      : "border-slate-700/70 bg-slate-950/80 text-slate-200 hover:border-slate-600/90 hover:bg-slate-900/95"
                  }`}
                >
                  {channel.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Account</p>
                {isSignedIn ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-white">{user?.username || user?.email || "Commander"}</p>
                    <p className="text-xs text-slate-500">Signed in</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-white">Guest access</p>
                )}
              </div>
              <Link
                href="/beta"
                className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100 hover:border-amber-400/50"
              >
                Beta
              </Link>
            </div>
            <div className="mt-4 grid gap-2">
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    router.push(loginRedirect);
                  }}
                  className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link
                    href={loginRedirect}
                    className="nexus-button-primary w-full rounded-3xl px-4 py-3 text-sm font-semibold"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/register?redirect=${encodeURIComponent(pathname)}`}
                    className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Navigation</p>
            <div className="grid gap-2">
              {navLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nexus-interactive-btn flex items-center gap-3 rounded-3xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-amber-400/70 bg-amber-500/10 text-amber-100 shadow-[0_8px_32px_rgba(251,191,36,0.14)]"
                        : "border-slate-700/70 bg-slate-950/80 text-slate-200 hover:border-slate-600/90 hover:bg-slate-900/95"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-700/70 bg-slate-900/85 p-5 text-sm text-slate-300">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Library</p>
            <div className="mt-3 grid gap-2">
              {libraryItems.map((item) => (
                <button key={item.label} className="nexus-interactive-card flex items-center gap-3 rounded-3xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-[#121014]">
                  <item.icon className="h-4 w-4 text-amber-300" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Quick launch</p>
            <div className="mt-3 grid gap-2">
              {quickLaunch.map((action) => (
                <button key={action.label} className="nexus-interactive-card flex items-center gap-3 rounded-3xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 hover:border-amber-400/60 hover:bg-[#121014]">
                  <action.icon className="h-4 w-4 text-amber-300" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-700/70 bg-slate-900/85 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Commander</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-3xl border border-amber-400/15 bg-[#13080d] p-4">
              <div>
                <p className="text-sm font-semibold text-white">ShadowByte</p>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Online</p>
              </div>
              <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-100">Live</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5">
            {statusItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-200">
                <span>{item.label}</span>
                <span className={`${item.tone} font-semibold`}>{item.value}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          {routeBackground ? (
            <section className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-950/90 shadow-[0_30px_90px_rgba(0,0,0,0.35)] nexus-shell nexus-shell-atmos">
              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-400 via-amber-400 to-fuchsia-400 opacity-90" />
              <div
                className="absolute inset-0 opacity-80 bg-center bg-cover route-background"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/15 to-[#09040b]/95" />
              <div className="relative grid gap-4 p-6 sm:p-8 lg:grid-cols-[1.9fr_0.95fr] lg:items-end">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Route preview</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{routeInfo.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{routeInfo.subtitle}</p>
                </div>
                <div className="rounded-[28px] border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100 shadow-[0_18px_40px_rgba(251,191,36,0.16)]">
                  <p className="uppercase tracking-[0.22em] text-amber-200">Custom design active</p>
                  <p className="mt-2 text-sm text-slate-200">This page is using your new layout assets for a faithful visual match.</p>
                </div>
              </div>
            </section>
          ) : null}
          <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">{routeInfo.breadcrumb}</p>
                <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">{routeInfo.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{routeInfo.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="nexus-button-primary rounded-3xl px-4 py-3 text-sm font-semibold">Launch</button>
                <button className="nexus-button-secondary rounded-3xl px-4 py-3 text-sm font-semibold">Invite</button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Server</p>
                <p className="mt-3 text-sm font-semibold text-white">NexusForge HQ</p>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Status</p>
                <p className="mt-3 text-sm font-semibold text-white">Live • 25 active</p>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Mode</p>
                <p className="mt-3 text-sm font-semibold text-white">Premium Forge</p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Channel bar</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">#{routeInfo.title.toLowerCase().replace(/\s+/g, "-")}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Overview" },
                  { label: "Members" },
                  { label: "Rooms" },
                  { label: "Invite" },
                ].map((tab) => (
                  <button key={tab.label} type="button" className="rounded-2xl border border-slate-700/70 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 transition hover:border-amber-400/60 hover:bg-slate-900/95">
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4">
              {channelList.map((channel) => {
                const active = pathname === channel.href || (channel.href !== "/app" && pathname?.startsWith(channel.href));
                return (
                  <Link
                    key={channel.href}
                    href={channel.href}
                    className={`rounded-3xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-amber-400/70 bg-amber-500/10 text-amber-100"
                        : "border-slate-700/70 bg-slate-950/80 text-slate-200 hover:border-amber-400/60 hover:bg-slate-900/95"
                    }`}
                  >
                    <p className="text-sm font-semibold">#{channel.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{channel.description}</p>
                  </Link>
                );
              })}
            </div>
            {children}
          </section>
        </main>
        <aside className="hidden xl:flex sticky top-6 flex-col gap-6 rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_35px_100px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/95 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Workspace</p>
                <p className="mt-2 text-lg font-semibold text-white">Live command deck</p>
              </div>
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-5 grid gap-3">
              {statusItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-3xl bg-slate-950/90 px-4 py-3 text-sm text-slate-200">
                  <span>{item.label}</span>
                  <span className={`${item.tone} font-semibold`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/95 p-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Voice stage</p>
            <div className="mt-4 rounded-3xl border border-amber-400/10 bg-[#111318] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Stage channel</p>
                  <p className="text-xs text-slate-500">4 rooms in progress</p>
                </div>
                <div className="rounded-2xl bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-amber-100">Live</div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-3xl bg-slate-950/90 px-3 py-2">
                  <span>Squad voice</span>
                  <span className="text-amber-300">13</span>
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-slate-950/90 px-3 py-2">
                  <span>Stage audience</span>
                  <span className="text-slate-200">102</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/95 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Quick actions</p>
                <p className="mt-2 text-sm font-semibold text-white">Jump to action</p>
              </div>
              <Gift className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-4 grid gap-3">
              <button className="nexus-button-primary w-full rounded-3xl px-4 py-3 text-sm font-semibold">New room</button>
              <button className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold">Invite crew</button>
              <button className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold">Refresh status</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
