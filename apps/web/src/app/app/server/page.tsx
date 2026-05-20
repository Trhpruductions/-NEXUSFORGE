import type { Metadata } from "next";
import Link from "next/link";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NexusForge Command Center | Servers",
  description: "Browse your server roster, rooms, and invite activity inside NexusForge.",
};

const serverList = [
  { name: "NexusForge Forge", type: "Community", online: 124, rooms: 18, status: "Live" },
  { name: "Crimson Ops", type: "Private", online: 82, rooms: 8, status: "Raid Active" },
  { name: "Nightcore Squad", type: "Creator", online: 39, rooms: 6, status: "Voice Ready" },
  { name: "Iron Vanguard", type: "Esports", online: 57, rooms: 11, status: "Match In Progress" },
];

export default function ServerPage() {
  const serverHeroImage = getCustomDesignImageUrl(["app-server-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Community</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Community hubs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">Discover shared listening spaces, manage your social lounges, and keep your community connected with curated audio rooms.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/join" className="nexus-button-primary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Join server</Link>
            <Link href="/app" className="nexus-button-secondary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Back to dashboard</Link>
          </div>
        </div>
      </section>

      <DynamicBackground
        url={serverHeroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-950/85 shadow-[0_30px_80px_rgba(0,0,0,0.35)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 text-slate-100">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Server preview</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Live listening hub preview</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Your server dashboard now mirrors the custom listening room experience with active audio lounge visuals.</p>
        </div>
      </DynamicBackground>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6 rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Active rosters</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Forge servers</h2>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">{serverList.length} hubs</span>
          </div>
          <div className="grid gap-4">
            {serverList.map((server) => (
              <div key={server.name} className="group rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-amber-400/50">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-400">{server.type}</p>
                    <h3 className="mt-3 text-xl font-semibold text-white">{server.name}</h3>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">{server.status}</span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="uppercase tracking-[0.2em] text-slate-500">Online</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{server.online}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="uppercase tracking-[0.2em] text-slate-500">Rooms</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{server.rooms}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="uppercase tracking-[0.2em] text-slate-500">Engagement</p>
                    <p className="mt-2 text-2xl font-semibold text-white">+28%</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="nexus-button-primary rounded-full px-5 py-3 text-sm font-semibold">Open hub</button>
                  <button className="nexus-button-secondary rounded-full px-5 py-3 text-sm font-semibold">View details</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Quick actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Forge tools</h2>
            </div>
            <span className="rounded-full bg-rose-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-100">Instant</span>
          </div>
          <div className="mt-6 space-y-4">
            {[
              { label: 'Invite Builder', detail: 'Create server access codes' },
              { label: 'Boost Panel', detail: 'Increase server visibility' },
              { label: 'Voice Ops', detail: 'Launch a live arena' },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
