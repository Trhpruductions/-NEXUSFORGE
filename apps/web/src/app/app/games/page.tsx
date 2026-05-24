import type { Metadata } from "next";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Games",
  description: "Browse game hubs and launch directly into the experience.",
};

const hubs = [
  { name: "Call of Duty: MWIII", genre: "FPS", players: "1.2K" },
  { name: "Rocket League", genre: "Sports", players: "892" },
  { name: "Minecraft", genre: "Survival", players: "2.1K" },
  { name: "Valorant", genre: "Competitive", players: "3.4K" },
  { name: "Elden Ring", genre: "RPG", players: "1.7K" },
];

export default function GamesPage() {
  const heroImage = getCustomDesignImageUrl(["app-games-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Game hubs</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Play ready arenas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Browse live game zones, community arenas, and listening-ready matches with the same custom command center visuals.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Game hubs</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">Play ready arenas</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Launch into curated arenas, join friends faster, and discover what communities are listening to while they play.</p>
          </div>
          <button className="nexus-button-primary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Browse all</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hubs.map((hub) => (
            <div key={hub.name} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5 transition hover:border-amber-400/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{hub.genre}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{hub.name}</h3>
                </div>
                <span className="rounded-full bg-[#1f0a0e] px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">{hub.players}</span>
              </div>
              <div className="mt-6 h-36 rounded-[24px] bg-gradient-to-br from-[#15040a] via-[#0d0407] to-[#060204]" />
              <button className="mt-5 rounded-full border border-amber-400/20 bg-[#17080b] px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/10">Play</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Hot recommendations</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Dark Souls III", score: "4.7" },
            { title: "Hollow Knight", score: "4.9" },
            { title: "God of War Ragnarök", score: "4.8" },
            { title: "Starfield", score: "4.6" },
          ].map((item) => (
            <div key={item.title} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Rating {item.score}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
