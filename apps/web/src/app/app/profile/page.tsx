import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Sparkles, UserCircle, Zap } from "lucide-react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Profile",
  description: "Customize your commander profile, avatar, and identity settings.",
};

export default function ProfilePage() {
  const heroImage = getCustomDesignImageUrl(["app-profile-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Profile</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Commander identity</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Personalize your social presence, avatar, and onboarding details for the community listening experience.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Profile</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Commander profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">Adjust your identity, avatar, and connected Forge details for the NexusForge command surface.</p>
          </div>
          <Link href="/app/settings" className="nexus-button-secondary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">
            Profile settings
          </Link>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 shadow-[0_14px_32px_rgba(251,191,36,0.22)]">
                <Image
                  src="/brand/nexusforge-logo.png"
                  alt="NexusForge"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Command alias</p>
                <p className="mt-2 text-3xl font-semibold text-white">Astra Nova</p>
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="rounded-[24px] border border-slate-700/70 bg-[#12070b]/95 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Default region</p>
                <p className="mt-2 font-semibold text-white">North America</p>
              </div>
              <div className="rounded-[24px] border border-slate-700/70 bg-[#12070b]/95 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Security mode</p>
                <p className="mt-2 font-semibold text-white">2FA enabled</p>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <UserCircle className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Identity</span>
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-300">Set your social alias, customize your avatar, and sync your presence across launcher and chat surfaces.</div>
            <div className="mt-6 grid gap-3">
              <button className="nexus-button-primary rounded-3xl px-4 py-3 text-sm font-semibold">Edit profile</button>
              <button className="nexus-button-secondary rounded-3xl px-4 py-3 text-sm font-semibold">Connect account</button>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Commander traits</p>
            <p className="mt-2 text-2xl font-semibold text-white">Ranked reputation</p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Elite</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Rank", value: "Gold", icon: Zap },
            { label: "Badges", value: "12", icon: BadgeCheck },
            { label: "Followers", value: "1.2K", icon: Sparkles },
          ].map((item) => (
            <div key={item.label} className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-5 text-slate-300">
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-amber-300" />
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
