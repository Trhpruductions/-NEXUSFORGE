import type { Metadata } from "next";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Rewards",
  description: "Unlock perks, boost your account, and spend reward credits.",
};

const rewards = [
  { title: "Premium Badge", cost: "250" },
  { title: "Custom Avatar", cost: "180" },
  { title: "Server Boost", cost: "320" },
];

export default function RewardsPage() {
  const heroImage = getCustomDesignImageUrl(["app-rewards-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Rewards</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Claim your vault</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Unlock exclusive perks that reward engagement, listening sessions, and community contributions across NexusForge.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Rewards</p>
        <h2 className="mt-3 text-4xl font-semibold text-white">Claim your vault</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Earn XP for squad invites, community listening, and live activity — then spend it on custom badges, avatars, and boosts.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{item.title}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{item.cost} XP</p>
              <button className="mt-5 rounded-full border border-amber-400/20 bg-[#17080b] px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/10">Redeem</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Balance</p>
            <p className="mt-2 text-3xl font-semibold text-white">2,450 XP</p>
          </div>
          <button className="nexus-button-primary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Earn more</button>
        </div>
      </section>
    </div>
  );
}
