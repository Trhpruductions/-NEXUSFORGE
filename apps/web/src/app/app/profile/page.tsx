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
    <div className="cinematic-stage metal-corners space-y-6 text-slate-100 nf-content-rhythm">
      <div className="cinematic-particles" />
      <DynamicBackground
        url={heroImage}
        className="forge-frame relative min-h-[420px] overflow-hidden rounded-[32px] bg-cover bg-center backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/35 to-slate-950/92" />
        <div className="absolute inset-0 bg-slate-900/45" />
        <div className="relative p-6 sm:p-8">
          <p className="nf-type-eyebrow text-sky-300">Profile ops</p>
          <h1 className="mt-3 nf-type-title text-slate-100">Identity built for serious sessions</h1>
          <p className="mt-3 max-w-3xl nf-type-body text-slate-300">Set your alias, profile visuals, and account posture for competitive and creator-focused communities.</p>
        </div>
      </DynamicBackground>

      <section className="forge-frame rounded-[32px] p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="nf-type-eyebrow text-sky-300">Profile</p>
            <h1 className="mt-3 nf-type-title text-slate-100">Profile settings</h1>
            <p className="mt-2 max-w-2xl nf-type-body text-slate-300">Adjust identity, avatar, and connected Forge details with clean operational UX.</p>
          </div>
          <Link href="/app/settings" className="forge-btn-secondary inline-flex rounded-full px-6 py-3 text-sm font-medium transition-all nf-interact">
            Profile settings
          </Link>
        </div>
      </section>

      <section className="forge-frame rounded-[32px] p-6 backdrop-blur-xl">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_0.9fr]">
          <div className="forge-panel rounded-[28px] p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-200 to-sky-200 shadow-sm">
                <Image
                  src="/brand/nexusforge-logo.png"
                  alt="NexusForge"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Display name</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Astra Nova</p>
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-400">
              <div className="forge-panel rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Default region</p>
                <p className="mt-2 font-semibold text-slate-100">North America</p>
              </div>
              <div className="forge-panel rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Security mode</p>
                <p className="mt-2 font-semibold text-slate-100">2FA enabled</p>
              </div>
            </div>
          </div>

          <aside className="forge-panel rounded-[28px] p-6">
            <div className="flex items-center gap-3 text-sky-300">
              <UserCircle className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Identity</span>
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-400">Set your social alias, customize your avatar, and keep your presence consistent across surfaces.</div>
            <div className="mt-6 grid gap-3">
              <button className="forge-btn-secondary rounded-3xl px-4 py-3 text-sm font-medium transition-all nf-interact">Edit profile</button>
              <button className="forge-btn-secondary rounded-3xl px-4 py-3 text-sm font-medium transition-all nf-interact">Connect account</button>
            </div>
          </aside>
        </div>
      </section>

      <section className="forge-frame rounded-[32px] p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="nf-type-eyebrow text-sky-300">Profile traits</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Visible reputation</p>
          </div>
          <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs uppercase tracking-[0.18em] text-sky-200">Elite</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Rank", value: "Gold", icon: Zap },
            { label: "Badges", value: "12", icon: BadgeCheck },
            { label: "Followers", value: "1.2K", icon: Sparkles },
          ].map((item) => (
            <div key={item.label} className="forge-panel rounded-[28px] p-5 text-slate-400 nf-interact">
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-sky-300" />
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
