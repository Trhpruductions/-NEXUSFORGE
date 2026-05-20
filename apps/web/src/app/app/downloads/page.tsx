import type { Metadata } from "next";
import Link from "next/link";
import { CloudDownload, ShieldCheck } from "lucide-react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export const metadata: Metadata = {
  title: "NEXUSFORGE | Downloads",
  description: "Manage your downloads, updates, and launcher content.",
};

const downloads = [
  { title: "NexusForge Launcher", status: "Up to date", size: "124 MB" },
  { title: "Forge Assets Pack", status: "Downloading", size: "2.1 GB" },
  { title: "Event Map Pack", status: "Pending", size: "540 MB" },
];

export default function DownloadsPage() {
  const heroImage = getCustomDesignImageUrl(["app-downloads-desktop.jpg"], "/app-hero.png");

  return (
    <div className="space-y-6">
      <DynamicBackground
        url={heroImage}
        className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#09040b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Downloads</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Launcher content</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Keep your Forge content up to date, sync design assets, and stay ready for every listening session.</p>
        </div>
      <div className="relative p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Downloads</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Launcher content</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Keep your Forge content up to date, sync design assets, and stay ready for every listening session.</p>
        <Link href="/app" className="mt-6 inline-flex rounded-full border border-slate-700/70 bg-slate-950/85 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-amber-400/70 hover:bg-slate-900/95">
          Back to dashboard
        </Link>
      </div>
    </DynamicBackground>

    <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Active queue</p>
            <p className="mt-2 text-2xl font-semibold text-white">Download progress</p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Syncing</span>
        </div>

        <div className="mt-6 grid gap-4">
          {downloads.map((download) => (
            <div key={download.title} className="group rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-5 transition hover:border-amber-400/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{download.title}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{download.title}</h3>
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-100">{download.status}</span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Size</p>
                  <p className="mt-2 text-lg font-semibold text-white">{download.size}</p>
                </div>
                <button className="nexus-button-primary rounded-full px-5 py-3 text-sm font-semibold">Manage</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <CloudDownload className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Downloads hub</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">Monitor package integrity, asset versions, and platform updates. NexusForge keeps everything in sync across your launch ecosystem.</p>
          </div>
          <div className="rounded-[28px] border border-slate-700/70 bg-[#0a0407]/95 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.28em]">Protected installs</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">All content passes secure validation before it installs, reducing corrupted assets and giving you a faster launcher experience.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
