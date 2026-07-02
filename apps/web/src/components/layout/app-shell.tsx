"use client";

import Image from "next/image";
import Link from "next/link";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { AppLeftDock } from "@/components/layout/app-left-dock";

export function AppShell({ homeHeroSrc }: { homeHeroSrc: string }) {
  return (
    <div className="relative grid gap-6 lg:grid-cols-[72px_minmax(0,1.05fr)_0.95fr] text-slate-100 nf-content-rhythm">
      <AppLeftDock className="hidden lg:flex flex-col items-center gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl" />
      <div className="space-y-6 nf-motion-rise nf-delay-80">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3 nf-type-eyebrow text-slate-400">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">NexusForge workspace</span>
              </div>
              <h1 className="nf-type-title text-slate-100 sm:text-6xl">A calmer dashboard for every squad and studio.</h1>
              <p className="max-w-2xl nf-type-body text-slate-400">NexusForge brings your communities, voice rooms, and live feeds into one focused workspace.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/app" className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900 px-6 py-4 text-sm font-semibold text-slate-100 shadow-sm transition-colors hover:bg-slate-900/70">Open workspace</Link>
                <Link href="/pricing" className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900 px-6 py-4 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-900/70">Explore Core+</Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-400">
                <div className="rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2">Live sync ready</div>
              </div>
            </div>
            <DynamicBackground
              url={homeHeroSrc}
              className="relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] bg-cover bg-center"
            >
              <div className="absolute inset-0 bg-slate-900/45" />
              <div className="absolute inset-x-0 bottom-0 rounded-[20px] bg-gradient-to-t from-white/95 to-transparent px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                  <span className="rounded-full bg-slate-900/90 px-3 py-2 shadow-sm">Featured</span>
                  <span className="rounded-full bg-amber-50 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-700">Live</span>
                </div>
              </div>
            </DynamicBackground>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 nf-stagger nf-stagger-base-120">
          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] nf-stagger-item-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Followers</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">1,245</p>
          </div>
          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] nf-stagger-item-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Uploads</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">342</p>
          </div>
          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] nf-stagger-item-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Activity</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">8.4k</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_26px_70px_rgba(15,23,42,0.08)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Discover</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Featured rooms</h2>
            <div className="mt-5 grid gap-3">
              {[
                { title: 'Cosmic Realms', subtitle: 'Active raid hub' },
                { title: 'Neon Ascent', subtitle: 'Competitive crew' },
              ].map((server) => (
                <div key={server.title} className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-100">{server.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{server.subtitle}</p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-500 shadow-sm">Live</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-5 shadow-[0_26px_70px_rgba(15,23,42,0.08)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Community</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Quick notes</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">Stay connected to voice rooms, squad invites, and community goals without extra visual noise.</p>
            <div className="mt-5 space-y-3 text-sm text-slate-400">
              <div className="rounded-[22px] border border-slate-700/70 bg-slate-900/70 px-4 py-3">Live rooms: 12</div>
              <div className="rounded-[22px] border border-slate-700/70 bg-slate-900/70 px-4 py-3">Active squads: 18</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-6 nf-motion-rise nf-delay-160">
        <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/70 ring-1 ring-slate-900/5">
              <Image
                src="/brand/nexusforge-main-logo.png"
                alt="NexusForge"
                width={40}
                height={40}
                className="w-auto h-auto object-contain"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-amber-600">Profile</p>
              <p className="text-lg font-semibold text-slate-100">Astra Nova</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Creator</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm text-slate-400">
            <div className="rounded-[22px] bg-slate-900/70 p-3">Followers 1,245</div>
            <div className="rounded-[22px] bg-slate-900/70 p-3">Sync status: active</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

