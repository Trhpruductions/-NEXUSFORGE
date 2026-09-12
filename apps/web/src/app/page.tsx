import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Crosshair,
  Gamepad2,
  Mic2,
  Radio,
  ShieldCheck,
  Sparkles,
  Users2,
  Wrench,
  Zap,
} from "lucide-react";

const pillars = [
  { label: "Play", icon: Gamepad2, note: "Squads, scrims and LFG channels built for the games you grind." },
  { label: "Connect", icon: Users2, note: "Voice rooms, DMs and friends that follow you across every forge." },
  { label: "Create", icon: Wrench, note: "Bots, custom roles and forge templates that ship in minutes." },
  { label: "Dominate", icon: Crosshair, note: "Leaderboards, rewards and live stats that keep the squad hungry." },
];

const features = [
  {
    title: "Forges, not servers",
    description: "Spin up a community from a gaming, esports or creator template. Channels, roles and invite links are ready before your first message.",
    icon: Zap,
  },
  {
    title: "Voice that keeps up",
    description: "Low-latency voice and stage rooms with noise suppression, screen share and live presence for every channel.",
    icon: Mic2,
  },
  {
    title: "Real moderation tools",
    description: "Ranked roles, kick and ban controls, nickname overrides and a ban list that actually blocks rejoins.",
    icon: ShieldCheck,
  },
  {
    title: "Bots and automation",
    description: "Install community bots or build your own with slash commands, webhooks and OAuth apps from the developer portal.",
    icon: Bot,
  },
  {
    title: "Go live from inside",
    description: "Creator status, stream links and live viewer counts sit right on your profile so your community never misses a broadcast.",
    icon: Radio,
  },
  {
    title: "Rewards and economy",
    description: "Medals, boosts, mining rigs and progressive jackpots give members something to chase between matches.",
    icon: Sparkles,
  },
];

const stats = [
  { value: "<50ms", label: "voice latency target" },
  { value: "4", label: "forge templates" },
  { value: "7", label: "granular permissions" },
  { value: "24/7", label: "uptime monitoring" },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05030f] text-slate-100 selection:bg-amber-500/40 selection:text-white scroll-smooth">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.24),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(124,58,237,0.18),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]" />

      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#05030f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-slate-950/80 shadow-[0_0_24px_rgba(139,61,255,0.35)]">
              <Image src="/brand/vexora-mark.png" alt="Vexora Gaming" width={32} height={32} className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="nf-heading text-sm font-semibold uppercase tracking-[0.32em] text-white">Vexora</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-amber-300">Gaming</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["Workspace", "/app"],
              ["Pricing", "/pricing"],
              ["Developers", "/developer"],
              ["Support", "/support"],
            ].map(([label, href]) => (
              <Link key={label} href={href} className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 transition-colors hover:text-white">
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-amber-400/50 hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#3b82f6,#8b3dff_55%,#c026d3)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_30px_rgba(139,61,255,0.45)] transition hover:-translate-y-px hover:shadow-[0_14px_36px_rgba(139,61,255,0.6)]"
            >
              Join free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-24">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(196,150,255,0.9)]" />
              Built for gamers. Connected by community.
            </div>
            <h1 className="nf-heading text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your squad&apos;s home base,
              <span className="block bg-[linear-gradient(120deg,#60a5fa,#a78bfa_45%,#e879f9)] bg-clip-text text-transparent">
                forged for the grind.
              </span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Vexora Gaming is a next-generation community platform for gamers, creators and esports teams. Text, voice, roles,
              bots and rewards in one fast desktop and web app, with moderation tools that actually hold the line.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#3b82f6,#8b3dff_55%,#c026d3)] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_40px_rgba(139,61,255,0.45)] transition hover:-translate-y-px"
              >
                Create your forge <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/downloads"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 backdrop-blur transition hover:border-amber-400/40 hover:bg-white/10"
              >
                Get the desktop app
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <dt className="nf-heading text-xl font-bold text-white">{stat.value}</dt>
                  <dd className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(139,61,255,0.35),transparent_60%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-amber-400/25 bg-slate-950/70 p-3 shadow-[0_40px_120px_rgba(59,130,246,0.25)]">
              <Image
                src="/brand/vexora-logo.png"
                alt="Vexora Gaming emblem and wordmark"
                width={955}
                height={875}
                priority
                className="h-auto w-full rounded-[24px] object-cover"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto grid max-w-7xl gap-4 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {pillars.map((pillar) => (
              <div key={pillar.label} className="group rounded-2xl border border-white/8 bg-slate-950/60 p-5 transition hover:border-amber-400/40 hover:shadow-[0_0_30px_rgba(139,61,255,0.25)]">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <p className="nf-heading text-sm font-bold uppercase tracking-[0.3em] text-white">{pillar.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{pillar.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">Everything a community needs</p>
            <h2 className="nf-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">One app for the whole squad.</h2>
            <p className="text-slate-400">
              Familiar where it should be, faster where it counts, and customizable everywhere else.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-[24px] border border-white/8 bg-slate-950/60 p-6 transition hover:border-amber-400/35">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(59,130,246,0.35),rgba(168,85,247,0.35))] text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
          <div className="relative overflow-hidden rounded-[32px] border border-amber-400/25 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,61,255,0.22)_55%,rgba(192,38,211,0.18))] px-8 py-12 text-center shadow-[0_30px_90px_rgba(139,61,255,0.25)] sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_50%)]" />
            <p className="relative text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200">Ready when you are</p>
            <h2 className="nf-heading relative mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Forge your community on Vexora Gaming.</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-200">
              Free to start. Bring your squad, pick a template, and be live in under a minute.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-lg transition hover:-translate-y-px"
              >
                Create account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
              >
                Open workspace
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-slate-500 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Image src="/brand/vexora-mark.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
            <span>Vexora Gaming © 2026. Built for gamers. Connected by community.</span>
          </div>
          <div className="flex items-center gap-5 uppercase tracking-[0.18em]">
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/support" className="transition hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
