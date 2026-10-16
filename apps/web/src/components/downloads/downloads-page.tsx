"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Download, Gamepad2, Loader2, Monitor, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { DesktopUpdateCenter } from "@/components/desktop/desktop-update-center";

type Manifest = {
  version: string;
  notes?: string[];
  downloadUrl: string;
  downloadUrls?: string[];
  sha256?: string;
  forceUpdate?: boolean;
};

const panel = "vx-panel rounded-2xl p-4";
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
        <p className="text-xs text-slate-400">Nexus Forge Gaming for Windows: its own window, a taskbar icon and automatic updates.</p>
      </div>

      <DesktopUpdateCenter />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(46,164,255,0.25),transparent_50%)]" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300"><Monitor className="h-3.5 w-3.5" /> Desktop app</p>
              <h2 className="nf-heading mt-2 text-2xl font-bold text-white">Nexus Forge Gaming Desktop</h2>
              {manifestQuery.isLoading ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking latest version...</p>
              ) : manifest ? (
                <>
                  <p className="mt-2 text-sm text-slate-300">Version {manifest.version} for Windows 10 and 11. Installs in a few clicks and updates itself.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={manifest.downloadUrl} className={goldBtn}><Download className="h-4 w-4" /> Download for Windows</a>
                  </div>
                  {manifest.sha256 ? (
                    <p className="mt-3 inline-flex items-start gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> <span className="whitespace-nowrap">SHA-256</span> <span className="break-all font-mono text-slate-400">{manifest.sha256}</span></p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-rose-200">The release manifest could not be loaded. Try again shortly.</p>
              )}
            </div>
            <div className="hidden h-40 w-40 items-center justify-center rounded-2xl border border-amber-500/30 bg-[radial-gradient(circle,rgba(46,164,255,0.3),transparent_70%)] md:flex">
              <Image src="/brand/nexusforge-emblem-256.png" alt="" width={112} height={112} className="h-28 w-28 rounded-2xl object-cover" />
            </div>
          </div>
        </section>

        {/* Consoles and phones: the web app, installed from the browser. */}
        <section className="grid gap-4 md:grid-cols-2 xl:col-start-1">
          <div className={panel}>
            <h3 className="nf-heading mb-2 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white"><Gamepad2 className="h-4 w-4 text-emerald-300" /> Play on Xbox</h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
              <li>On your Xbox, open <strong className="text-white">Microsoft Edge</strong> (it&apos;s in My games &amp; apps).</li>
              <li>Go to <strong className="text-white">nfgcord.com</strong> and sign in.</li>
              <li>Press the <strong className="text-white">Menu</strong> button and choose <strong className="text-white">Pin to Home</strong> so it opens like an app.</li>
            </ol>
            <p className="mt-2 text-[11px] text-slate-500">A USB or Bluetooth keyboard makes typing on Xbox much faster.</p>
          </div>
          <div className={panel}>
            <h3 className="nf-heading mb-2 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white"><Smartphone className="h-4 w-4 text-sky-300" /> Phone, tablet or Mac</h3>
            <p className="text-xs text-slate-300">Open <strong className="text-white">nfgcord.com</strong> in your browser, then:</p>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
              <li><strong className="text-white">Android / Chrome / Edge:</strong> menu → <em>Install app</em></li>
              <li><strong className="text-white">iPhone / iPad:</strong> Share → <em>Add to Home Screen</em></li>
            </ul>
          </div>
        </section>

        <aside className="space-y-4 xl:col-start-2 xl:row-start-1 xl:row-span-2">
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
