"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Download, Loader2, Monitor, ShieldCheck, Sparkles } from "lucide-react";

type Manifest = {
  version: string;
  notes?: string[];
  downloadUrl: string;
  downloadUrls?: string[];
  sha256?: string;
  forceUpdate?: boolean;
};

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300";

export function DownloadsPage() {
  const manifestQuery = useQuery({
    queryKey: ["desktop-manifest"],
    queryFn: async () => {
      const response = await fetch("/desktop-update.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Manifest unavailable");
      return (await response.json()) as Manifest;
    },
  });
  const manifest = manifestQuery.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="nf-heading text-xl font-bold text-white">Downloads</h1>
        <p className="text-xs text-slate-400">Vexora Gaming for Windows. Faster voice, native notifications, and rich presence.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(230,179,37,0.25),transparent_50%)]" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300"><Monitor className="h-3.5 w-3.5" /> Desktop app</p>
              <h2 className="nf-heading mt-2 text-2xl font-bold text-white">Vexora Gaming Desktop</h2>
              {manifestQuery.isLoading ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking latest version...</p>
              ) : manifest ? (
                <>
                  <p className="mt-2 text-sm text-slate-300">Version {manifest.version} for Windows 10 and 11. Installs in under a minute and updates itself.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={manifest.downloadUrl} className={goldBtn}><Download className="h-4 w-4" /> Download for Windows</a>
                    {manifest.downloadUrls?.slice(1, 3).map((mirror, index) => (
                      <a key={mirror} href={mirror} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">Mirror {index + 1}</a>
                    ))}
                  </div>
                  {manifest.sha256 ? (
                    <p className="mt-3 inline-flex items-start gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> SHA-256 <span className="break-all font-mono text-slate-400">{manifest.sha256}</span></p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-rose-200">The release manifest could not be loaded. Try again shortly.</p>
              )}
            </div>
            <div className="hidden h-40 w-40 items-center justify-center rounded-2xl border border-amber-500/30 bg-[radial-gradient(circle,rgba(230,179,37,0.3),transparent_70%)] md:flex">
              <Image src="/brand/vexora-mark-gold-256.png" alt="" width={112} height={112} className="h-28 w-28 rounded-2xl object-cover" />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className={panel}>
            <h3 className="nf-heading mb-2 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white"><Sparkles className="h-4 w-4 text-amber-300" /> What&apos;s new</h3>
            {manifest?.notes?.length ? (
              <ul className="space-y-1.5 text-xs text-slate-300">
                {manifest.notes.map((note) => (
                  <li key={note} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" /> {note}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Release notes appear here with each version.</p>
            )}
          </div>
          <div className={panel}>
            <h3 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Requirements</h3>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>Windows 10 (1903) or Windows 11</li>
              <li>4 GB RAM, 500 MB free disk</li>
              <li>Microphone for voice channels</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
