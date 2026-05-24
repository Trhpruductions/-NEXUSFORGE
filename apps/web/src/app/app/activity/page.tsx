import type { Metadata } from "next";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Activity",
  description: "Review your activity feed and squad updates.",
};

const activity = [
  { when: "2m ago", user: "ArcticWolf", action: "Started a Valorant match" },
  { when: "5m ago", user: "LunaKnight", action: "Sent an invite to Apex Legends" },
  { when: "10m ago", user: "NightHawk", action: "Created a new server room" },
  { when: "15m ago", user: "PixelPirate", action: "Joined Rocket League" },
];

export default function ActivityPage() {
  const heroImage = getCustomDesignImageUrl(["app-activity-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Activity</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Live feed</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">See what your crew is doing now, track live sessions, and jump into audio spaces with the freshest listening updates.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Activity</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">Live feed</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Follow game launches, invite activity, and audio room joins across your community with a listening-first pulse feed.</p>
          </div>
          <button className="nexus-button-secondary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Filter</button>
        </div>
        <div className="mt-6 space-y-3">
          {activity.map((item) => (
            <div key={item.when} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5">
              <div className="flex items-center justify-between gap-3 text-slate-400">
                <p className="text-sm font-semibold text-white">{item.user}</p>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.when}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.action}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
