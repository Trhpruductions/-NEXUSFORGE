import Link from "next/link";
import { NexusforgeBrandShowcase } from "@/components/brand/nexusforge-brand-showcase";
import { PricingAndPayments } from "@/components/brand/pricing-and-payments";
import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip px-4 py-8 sm:px-8 lg:px-12">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8">
        <section className="grid gap-6 rounded-3xl border border-slate-700/80 bg-slate-950/50 p-6 backdrop-blur lg:grid-cols-[1.35fr_1fr] lg:p-9">
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
            <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
              <div className="glass-cut rounded-xl px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Realtime Fabric</p>
                <p className="mt-1 text-sm font-semibold">Events + DM + Voice</p>
              </div>
              <div className="glass-cut rounded-xl px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Premium Loop</p>
                <p className="mt-1 text-sm font-semibold">Core+ Telemetry</p>
              </div>
              <div className="glass-cut rounded-xl px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Scalable Stack</p>
                <p className="mt-1 text-sm font-semibold">Next + Prisma + Socket.IO</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.4)] hover:bg-cyan-300"
              >
                Launch NexusForge
              </Link>
              <Link
                href="/app"
                className="inline-flex h-11 items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-5 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
              >
                Open Command Center
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-xl border border-slate-600 bg-slate-900 px-5 text-sm font-semibold text-slate-100 hover:border-cyan-500/60"
              >
                Sign in
              </Link>
              <Link
                href="/notifications"
                className="inline-flex h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-5 text-sm font-semibold text-slate-100 hover:border-cyan-500/60"
              >
                Notifications
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-11 items-center rounded-xl border border-amber-500/40 bg-amber-950/20 px-5 text-sm font-semibold text-amber-100 hover:border-amber-300"
              >
                Admin
              </Link>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
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
          <div className="nexus-panel relative overflow-hidden rounded-2xl p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl" />
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Operations Pulse</h2>
            <div className="ember-frame holo-frame mb-3">
              <img
                src="/brand/nexusforge-main-logo.png"
                alt="NexusForge core logo"
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
        <NexusforgeBrandShowcase />
        <PricingAndPayments />
      </main>
    </div>
  );
}
