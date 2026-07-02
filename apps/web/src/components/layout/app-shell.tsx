"use client";

import Image from "next/image";
import Link from "next/link";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { AppLeftDock } from "@/components/layout/app-left-dock";

export function AppShell({ homeHeroSrc }: { homeHeroSrc: string }) {
  return (
    <div className="relative grid gap-6 lg:grid-cols-[72px_minmax(0,1.05fr)_0.95fr]">
      <AppLeftDock className="hidden lg:flex flex-col items-center gap-4 rounded-none border border-slate-700/70 bg-slate-950/95 p-4 shadow-[0_35px_100px_rgba(0,0,0,0.24)]" />
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_35px_100px_rgba(0,0,0,0.35)]">
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-amber-300">
                <span className="rounded-none border border-amber-400/30 bg-amber-400/10 px-3 py-1">NEXUSFORGE Command</span>
              </div>
              <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">A refined command center for every squad and studio.</h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300">NexusForge brings your communities, voice rooms, and live feeds into one polished dashboard.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/app" className="nexus-button-primary inline-flex items-center rounded-none px-6 py-4 text-sm font-semibold">Open Command</Link>
                <Link href="/pricing" className="nexus-button-secondary inline-flex items-center rounded-none px-6 py-4 text-sm font-semibold">Explore Core+</Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-none border border-slate-700/70 bg-slate-900/70 px-4 py-2">Live sync ready</div>
              </div>
            </div>
            <DynamicBackground
              url={homeHeroSrc}
              className="relative overflow-hidden rounded-none border border-slate-700/70 bg-slate-900/90 shadow-[0_30px_80px_rgba(0,0,0,0.35)] bg-cover bg-center"
            >
              <div className="absolute inset-0 bg-[#09040b]/75" />
              <div className="absolute inset-x-0 bottom-0 rounded-none bg-gradient-to-t from-slate-950/95 to-transparent px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
                  <span className="rounded-none bg-slate-900/80 px-3 py-2">Featured</span>
                  <span className="rounded-none bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Live</span>
                </div>
              </div>
            </DynamicBackground>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-none bg-slate-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Followers</p>
            <p className="mt-3 text-3xl font-semibold text-white">1,245</p>
          </div>
          <div className="rounded-none bg-slate-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Uploads</p>
            <p className="mt-3 text-3xl font-semibold text-white">342</p>
          </div>
          <div className="rounded-none bg-slate-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Activity</p>
            <p className="mt-3 text-3xl font-semibold text-white">8.4k</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.28)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Discover</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Featured rooms</h2>
            <div className="mt-5 grid gap-3">
              {[
                { title: 'Cosmic Realms', subtitle: 'Active raid hub' },
                { title: 'Neon Ascent', subtitle: 'Competitive crew' },
              ].map((server) => (
                <div key={server.title} className="rounded-none border border-slate-700/70 bg-slate-900/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{server.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{server.subtitle}</p>
                    </div>
                    <span className="rounded-none bg-slate-950/75 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">Live</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.28)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Community</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Quick notes</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">Stay connected to voice rooms, squad invites, and community goals without extra visual noise.</p>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <div className="rounded-none border border-slate-700/70 bg-slate-900/85 px-4 py-3">Live rooms: 12</div>
              <div className="rounded-none border border-slate-700/70 bg-slate-900/85 px-4 py-3">Active squads: 18</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-none bg-slate-800 ring-1 ring-amber-500/20">
              <Image
                src="/brand/nexusforge-main-logo.png"
                alt="NexusForge"
                width={40}
                height={40}
                className="w-auto h-auto object-contain"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Profile</p>
              <p className="text-lg font-semibold text-white">Astra Nova</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Creator</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm text-slate-300">
            <div className="rounded-none bg-slate-900/85 p-3">Followers 1,245</div>
            <div className="rounded-none bg-slate-900/85 p-3">Sync status: active</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

