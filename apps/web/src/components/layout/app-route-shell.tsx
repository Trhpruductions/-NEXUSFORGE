"use client";

import Image from "next/image";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Activity, Award, Bell, CloudDownload, Gamepad, Heart, Home, Layers, User, Users } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Community", href: "/app/server", icon: Layers },
  { label: "Listen", href: "/app/friends", icon: Users },
  { label: "Games", href: "/app/games", icon: Gamepad },
  { label: "Explore", href: "/search", icon: Activity },
  { label: "Activity", href: "/app/activity", icon: Activity },
  { label: "Rewards", href: "/app/rewards", icon: Award },
  { label: "Downloads", href: "/app/downloads", icon: CloudDownload },
  { label: "Notifications", href: "/app/notifications", icon: Bell },
  { label: "Profile", href: "/app/profile", icon: User },
  { label: "Settings", href: "/app/settings", icon: Heart },
];

const statusItems = [
  { label: "Live invites", value: "12", tone: "text-amber-300" },
  { label: "Voice rooms", value: "4", tone: "text-rose-300" },
  { label: "Active squads", value: "18", tone: "text-slate-100" },
];

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

function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/app" && pathname?.startsWith(href));
}

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

  return (
    <div className="min-h-screen bg-slate-950 text-foreground">
      <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6 rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-950/90 ring-1 ring-amber-500/20">
                <Image
                  src="/brand/nexusforge-main-logo.png"
                  alt="NexusForge"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300">NEXUSFORGE</p>
                <p className="text-lg font-semibold text-white">Command Center</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Account</p>
              {isSignedIn ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-white">{user?.username || user?.email || "Commander"}</p>
                  <p className="text-xs text-slate-500">Signed in</p>
                </>
              ) : (
                <p className="mt-2 text-sm font-semibold text-white">Guest access</p>
              )}
              <div className="mt-4 grid gap-2">
                {isSignedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearSession();
                      router.push(loginRedirect);
                    }}
                    className="w-full rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link href={loginRedirect} className="w-full rounded-3xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 text-center hover:bg-amber-400">
                      Sign in
                    </Link>
                    <Link
                      href={`/register?redirect=${encodeURIComponent(pathname)}`}
                      className="w-full rounded-3xl border border-slate-700/70 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 text-center hover:bg-slate-800"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>

            <nav className="rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Navigation</p>
              <div className="mt-4 grid gap-2">
                {navLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-amber-500/10 text-amber-100"
                          : "bg-slate-950/80 text-slate-200 hover:bg-slate-900/95"
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Status</p>
              <div className="mt-4 grid gap-3">
                {statusItems.map((item) => (
                  <div key={item.label} className="rounded-3xl bg-slate-950/90 px-4 py-3">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className={`mt-1 text-sm font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main id="main-content" aria-label="NexusForge app main content" className="space-y-6">
            <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">{routeInfo.breadcrumb}</p>
                  <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">{routeInfo.title}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{routeInfo.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/app/voice" className="rounded-3xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                    Launch
                  </Link>
                  <Link href="/app/join" className="rounded-3xl border border-slate-700/70 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                    Invite
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              {children}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}