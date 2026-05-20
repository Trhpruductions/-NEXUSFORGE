import Link from "next/link";
import { PricingAndPayments } from "@/components/brand/pricing-and-payments";
import { PoweredByFooter } from "@/components/layout/powered-by-footer";
import { NexusforgeBrandShowcase } from "@/components/brand/nexusforge-brand-showcase";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-slate-700/70 bg-slate-900/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-col gap-2 text-slate-400">
              <span className="text-xs uppercase tracking-[0.28em] text-amber-300">NexusForge Command</span>
              <p className="text-lg font-semibold text-white">A sharper, cleaner command center for your desktop launch experience.</p>
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">Streamline your community launcher with calm, crisp controls.</h1>
            <p className="text-base leading-8 text-slate-300">We’ve removed the visual clutter and noisy overlays so every action is easy to find and every panel feels intentional.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/app" className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                Open Launcher
              </Link>
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-950 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900">
                Explore Core+
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Minimal UI",
              description: "Clean panels, straightforward navigation, and consistent spacing for a calmer experience.",
            },
            {
              title: "Desktop-ready",
              description: "A layout built for app-first workflows with easy access to key controls and status at a glance.",
            },
            {
              title: "Fast access",
              description: "Launch rooms, invite crews, and manage settings from one streamlined console.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-[28px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">{item.title}</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
            <h2 className="text-2xl font-semibold text-white">Focused launch metrics</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Essential numbers for your team, presented without extra visual noise.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900/95 p-4 text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Active rooms</p>
                <p className="mt-2 text-2xl font-semibold text-white">12</p>
              </div>
              <div className="rounded-3xl bg-slate-900/95 p-4 text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Invite momentum</p>
                <p className="mt-2 text-2xl font-semibold text-white">312%</p>
              </div>
            </div>
          </div>
          <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
            <h2 className="text-2xl font-semibold text-white">Creator control</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Fast access to invites, audio rooms, and studio settings in a calm interface.</p>
            <div className="mt-6 space-y-3">
              <div className="rounded-3xl bg-slate-900/95 p-4 text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Likes</p>
                <p className="mt-2 text-2xl font-semibold text-white">5,678</p>
              </div>
              <div className="rounded-3xl bg-slate-900/95 p-4 text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Comments</p>
                <p className="mt-2 text-2xl font-semibold text-white">890</p>
              </div>
            </div>
          </div>
        </section>

        <PricingAndPayments />
        <NexusforgeBrandShowcase />
        <PoweredByFooter />
      </main>
    </div>
  );
}
