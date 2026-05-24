import type { Metadata } from "next";
import { Bell, Sparkles, ShieldCheck } from "lucide-react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Notifications",
  description: "Review notifications, alerts, and event updates.",
};

const notifications = [
  { title: "Squad invite received", detail: "ArcticWolf invited you to Valorant Central.", time: "2m ago", tone: "amber" },
  { title: "Update available", detail: "Launcher assets update ready to install.", time: "12m ago", tone: "rose" },
  { title: "Server event live", detail: "Nightcore Squad started a live raid.", time: "30m ago", tone: "amber" },
];

export default function NotificationsPage() {
  const heroImage = getCustomDesignImageUrl(["app-notifications-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Alert center</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Alert center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Stay on top of live invites, event updates, and community listening notifications with your custom command view.</p>
        </div>
      </DynamicBackground>

      <section className="rounded-[32px] border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Notifications</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Alert center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">Stay on top of invites, updates, and mission-critical alerts across your Forge ecosystem.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-[#12070b]/80 px-4 py-3 text-sm text-slate-300">
            <Bell className="h-5 w-5 text-amber-300" />
            3 new alerts
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="grid gap-4">
          {notifications.map((notification) => (
            <div key={notification.title} className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{notification.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{notification.detail}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${notification.tone === "amber" ? "bg-amber-500/10 text-amber-100" : "bg-rose-500/10 text-rose-100"}`}>
                  {notification.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Priority feed</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">High-priority alerts appear here, including server raids, update releases, and squad pings.</p>
          </div>
          <div className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Secure alerts</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">All notifications are authenticated and filtered to reduce noise, so your command feed stays relevant.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
