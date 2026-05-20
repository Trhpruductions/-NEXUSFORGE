import type { Metadata } from "next";
import Link from "next/link";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Settings",
  description: "Manage account, privacy, and app preferences in NexusForge.",
};

export default function SettingsPage() {
  const heroImage = getCustomDesignImageUrl(["app-settings-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Settings</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Command preferences</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Adjust your engine settings, social privacy, and alert controls for a tuned listening experience.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-[#5b1716]/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Settings</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Command preferences</h1>
          </div>
          <Link href="/app" className="nexus-button-secondary rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]">Back to dashboard</Link>
        </div>
        <div className="mt-6 space-y-4">
          {[
            { label: "Account", description: "Update your profile and security options." },
            { label: "Privacy", description: "Manage visibility, friend requests, and invites." },
            { label: "Notifications", description: "Control alerts for activity and events." },
          ].map((item) => (
            <div key={item.label} className="rounded-[28px] border border-[#4e1c16]/70 bg-[#0a0407]/95 p-5">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-2 text-sm text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
