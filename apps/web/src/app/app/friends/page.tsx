import type { Metadata } from "next";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Friends",
  description: "Manage your friends and squad roster inside NexusForge.",
};

const friends = [
  { name: "ArcticWolf", status: "Online", game: "Valorant" },
  { name: "LunaKnight", status: "In Game", game: "Apex Legends" },
  { name: "NightHawk", status: "Online", game: "League of Legends" },
  { name: "PixelPirate", status: "Idle", game: "Rocket League" },
  { name: "Ghostly", status: "In Lobby", game: "Minecraft" },
];

export default function FriendsPage() {
  const heroImage = getCustomDesignImageUrl(["app-friends-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Live listening</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Listen squad</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Connect with teammates, monitor live audio rooms, and keep your listening crew in sync while you jump into sessions.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Friends</p>
            <h2 className="mt-3 text-4xl font-semibold text-white">Squad roster</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Your social list is now aligned with shared listening sessions and quick invite actions.</p>
          </div>
          <button className="nexus-button-primary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Add friend</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {friends.map((friend) => (
            <div key={friend.name} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{friend.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{friend.status}</p>
                </div>
                <div className="rounded-full bg-[#1f0a0e] px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">{friend.game}</div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-300">
                <span className="rounded-full bg-[#11050a] px-3 py-2">Chat</span>
                <span className="rounded-full bg-[#11050a] px-3 py-2">Invite</span>
                <span className="rounded-full bg-[#11050a] px-3 py-2">Profile</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Social pulse</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Live status</h2>
          </div>
          <div className="rounded-full bg-[#1f0a0e] px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">Realtime</div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Friends online", value: "18" },
            { label: "Recent invites", value: "7" },
            { label: "Matches shared", value: "12" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#10040a]/95 p-4 text-slate-300">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
