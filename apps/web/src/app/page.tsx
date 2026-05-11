import Link from "next/link";
import Image from "next/image";
import { NexusforgeBrandShowcase } from "@/components/brand/nexusforge-brand-showcase";
import { PricingAndPayments } from "@/components/brand/pricing-and-payments";
import { PoweredByFooter } from "@/components/layout/powered-by-footer";
import { AppShell } from "@/components/layout/app-shell";

const accessGroups = [
  {
    title: "Public Routes",
    description: "Pages anyone can open before signing in.",
    items: [
      { label: "Home", href: "/", detail: "Product overview and launch entry" },
      { label: "Login", href: "/login", detail: "Restore an existing session" },
      { label: "Create account", href: "/register", detail: "Open a new NexusForge account" },
      { label: "Reset password", href: "/forgot-password", detail: "Generate a recovery token" },
      { label: "Pricing", href: "/pricing", detail: "View Core+ and paid access tiers" },
      { label: "Invite join", href: "/invite/demo", detail: "Join through a forge invite code" },
    ],
  },
  {
    title: "Signed-In Routes",
    description: "Pages that open after authentication.",
    items: [
      { label: "Command center", href: "/app", detail: "Forges, chat, DMs, voice, and live ops" },
      { label: "User search", href: "/search", detail: "Find players by username, tag, and reputation" },
      { label: "Leaderboards", href: "/leaderboards", detail: "Track reputation, streak, and medal rankings" },
      { label: "Notifications", href: "/notifications", detail: "Unread alerts and message activity" },
      { label: "Settings", href: "/settings", detail: "Profile and account preferences" },
      { label: "Core+", href: "/core-plus", detail: "Premium membership and billing workspace" },
      { label: "Invite join", href: "/invite/demo", detail: "Accept a forge invite while signed in" },
    ],
  },
  {
    title: "In-App Modules",
    description: "Surfaces available inside the command center.",
    items: [
      { label: "Public profiles", href: "/search", detail: "Open user pages with medals, activity, and account stats" },
      { label: "Forges", href: "/app", detail: "Community workspaces and server selection" },
      { label: "Channels", href: "/app", detail: "Text channels and message feeds" },
      { label: "Direct messages", href: "/app", detail: "Private conversations and threads" },
      { label: "Voice rooms", href: "/app", detail: "Live audio channels and stage access" },
      { label: "Friend network", href: "/app", detail: "Add, request, and manage friends" },
      { label: "Search, uploads, bots", href: "/app", detail: "Content discovery, file uploads, and bot tools" },
    ],
  },
  {
    title: "Privileged Tools",
    description: "Specialized surfaces for power users and admins.",
    items: [
      { label: "Premium checkout", href: "/pricing", detail: "Tier upgrades and paid feature packages" },
      { label: "Admin dashboard", href: "/admin", detail: "Moderation, revenue, and AI insight controls" },
      { label: "Account settings", href: "/settings", detail: "Identity, presence, and notifications" },
    ],
  },
];

const developmentLog = [
  {
    title: "Authentication flow",
    status: "Built",
    detail: "Login, register, and password reset pages are live and wired to session restore.",
    testTarget: "/login",
  },
  {
    title: "Forge command center",
    status: "Built",
    detail: "The /app shell includes forges, channels, DMs, voice rooms, and live operations panels.",
    testTarget: "/app",
  },
  {
    title: "Invite join flow",
    status: "Built",
    detail: "Public invite pages show forge details and can join directly when signed in.",
    testTarget: "/invite/demo",
  },
  {
    title: "Notifications and settings",
    status: "Built",
    detail: "Users can inspect alerts and update profile/presence settings from dedicated routes.",
    testTarget: "/notifications",
  },
  {
    title: "Premium and admin surfaces",
    status: "Built",
    detail: "Core+, pricing, checkout, and admin controls are present for premium and privileged users.",
    testTarget: "/pricing",
  },
  {
    title: "Desktop shell",
    status: "Built",
    detail: "Electron startup is isolated for local testing and the desktop health banner exposes maintenance actions.",
    testTarget: "npm run desktop:open",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip px-4 py-8 sm:px-8 lg:px-12">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-[8%] top-12 -z-10 h-56 w-56 rounded-full bg-cyan-500/12 blur-3xl" />
      <div className="pointer-events-none absolute right-[6%] top-28 -z-10 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8">
        <section className="nexus-display-panel grid gap-6 rounded-[32px] p-6 lg:grid-cols-[1.35fr_1fr] lg:p-9">
          <div className="space-y-5">
            <p className="font-[family-name:var(--font-orbitron)] text-xs uppercase tracking-[0.32em] text-cyan-300">
              NexusForge Platform
            </p>
            <h1 className="max-w-3xl font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Build a command network, not just another chat server.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
              Build gamer-focused communities with channels, streams, AI moderation, roles, premium upgrades,
              and clan events powered by a scalable Next.js + Socket.IO architecture.
            </p>
            <div className="grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
              <div className="nexus-metric-card rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Realtime Fabric</p>
                <p className="mt-1 text-sm font-semibold">Events + DM + Voice</p>
              </div>
              <div className="nexus-metric-card rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Premium Loop</p>
                <p className="mt-1 text-sm font-semibold">Core+ Telemetry</p>
              </div>
              <div className="nexus-metric-card rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Scalable Stack</p>
                <p className="mt-1 text-sm font-semibold">Next + Prisma + Socket.IO</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="nexus-signal-rail rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Concurrent Lanes</p>
                <p className="mt-2 text-2xl font-semibold text-white">48</p>
                <p className="mt-1 text-xs text-slate-400">Text, voice, billing, and notifications moving together.</p>
              </div>
              <div className="nexus-signal-rail rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Revenue Surface</p>
                <p className="mt-2 text-2xl font-semibold text-white">Core+</p>
                <p className="mt-1 text-xs text-slate-400">Subscriptions, boosts, and premium access feel native.</p>
              </div>
              <div className="nexus-signal-rail rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ops Status</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-100"><span className="nexus-signal-dot" />Stable</div>
                <p className="mt-1 text-xs text-slate-400">Desktop-first flows are live and visible right now.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="nexus-glow-button inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                Launch NexusForge
              </Link>
              <Link
                href="/app"
                className="nexus-outline-button inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                Open Command Center
              </Link>
              <Link
                href="/login"
                className="nexus-outline-button inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-500/60"
              >
                Sign in
              </Link>
              <Link
                href="/notifications"
                className="nexus-outline-button inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-500/60"
              >
                Notifications
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-11 items-center rounded-xl border border-amber-500/40 bg-amber-950/20 px-5 text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-300"
              >
                Admin
              </Link>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                Settings
              </Link>
              <Link
                href="/core-plus"
                className="inline-flex h-11 items-center rounded-xl border border-amber-500/35 bg-amber-950/25 px-5 text-sm font-semibold text-amber-100 hover:border-amber-300"
              >
                Core+
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/25 px-5 text-sm font-semibold text-fuchsia-100 hover:border-fuchsia-300"
              >
                Pricing
              </Link>
            </div>
          </div>
          <div className="nexus-display-panel slow-float relative overflow-hidden rounded-[28px] p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Operations Pulse</h2>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100"><span className="nexus-signal-dot" />Live</div>
            </div>
            <div className="ember-frame holo-frame mb-3">
              <Image
                src="/brand/nexusforge-main-logo.png"
                alt="NexusForge core logo"
                width={640}
                height={160}
                className="image-pan h-40 w-full rounded-2xl object-cover"
              />
            </div>
            <div className="space-y-2 text-xs text-slate-200">
              <div className="neo-badge flex items-center justify-between rounded-lg px-3 py-2">
                <span>Realtime Gateway</span>
                <span className="font-semibold text-emerald-200">ONLINE</span>
              </div>
              <div className="neo-badge flex items-center justify-between rounded-lg px-3 py-2">
                <span>Voice Fabric</span>
                <span className="font-semibold text-cyan-200">SYNCED</span>
              </div>
              <div className="neo-badge flex items-center justify-between rounded-lg px-3 py-2">
                <span>Core+ Layer</span>
                <span className="font-semibold text-amber-200">READY</span>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Alerts</p>
                <p className="mt-1 text-sm font-semibold text-white">12 active</p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Queues</p>
                <p className="mt-1 text-sm font-semibold text-white">3 warming</p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/55 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Monetization</p>
                <p className="mt-1 text-sm font-semibold text-white">Ready</p>
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-4">
          <div className="nexus-panel rounded-3xl p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Nexus Desk Layout</p>
            <h2 className="mt-1 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-3xl">
              Discord-style architecture, redesigned for high-performance communities.
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Familiar command ergonomics with stronger moderation lanes, premium telemetry, and monetization surfaces.
            </p>
          </div>
          <AppShell />
        </section>
        <section className="nexus-panel rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200">Accessible Surfaces</p>
              <h2 className="mt-1 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-3xl">
                Everything a user can reach.
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                This is the live map of public pages, signed-in routes, in-app modules, and privileged tools that the product exposes.
              </p>
            </div>
            <Link
              href="/app"
              className="inline-flex h-11 items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
            >
              Open Command Center
            </Link>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {accessGroups.map((group) => (
              <article key={group.title} className="glass-cut rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{group.title}</p>
                <p className="mt-1 text-sm text-slate-300">{group.description}</p>
                <div className="mt-4 grid gap-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 transition hover:border-cyan-500/60 hover:bg-cyan-950/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="nexus-panel rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200">TRH Development Log</p>
              <h2 className="mt-1 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-3xl">
                What is built right now.
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                This is the working inventory of completed surfaces so you can test directly from the current app.
              </p>
            </div>
            <Link
              href="/app"
              className="inline-flex h-11 items-center rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 text-sm font-semibold text-emerald-100 hover:border-emerald-300"
            >
              Test Command Center
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {developmentLog.map((entry) => (
              <article key={entry.title} className="glass-cut rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-50">{entry.title}</h3>
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-950/30 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                    {entry.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{entry.detail}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Test target</span>
                  {entry.testTarget.startsWith("/") ? (
                    <Link href={entry.testTarget} className="text-cyan-300 hover:text-cyan-200">
                      {entry.testTarget}
                    </Link>
                  ) : (
                    <span className="text-slate-300">{entry.testTarget}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <NexusforgeBrandShowcase />
        <PricingAndPayments />
        <PoweredByFooter />
      </main>
    </div>
  );
}
