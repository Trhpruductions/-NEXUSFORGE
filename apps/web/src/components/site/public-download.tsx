"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Gamepad2, Loader2, Monitor, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { DesktopUpdateCenter } from "@/components/desktop/desktop-update-center";
import { cn } from "@/lib/utils";

type Manifest = {
  version: string;
  notes?: string[];
  downloadUrl: string;
  sha256?: string;
};

const card = "rounded-2xl border border-white/[0.07] bg-[#0d1119] p-5 sm:p-6";
const sectionTitle = "nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-7 py-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-950 shadow-[0_14px_40px_rgba(46,164,255,0.3)] transition hover:-translate-y-px";

/**
 * The public download page body. The download link, version, checksum and release notes all come from
 * /desktop-update.json, the same release manifest the desktop app updates from.
 */
export function PublicDownload() {
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
    <div className="space-y-5">
      <DesktopUpdateCenter />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section id="get-the-app" aria-labelledby="get-heading" className="scroll-mt-24 rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5 sm:p-7">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300">
              <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> Windows app
            </p>
            <h2 id="get-heading" className="nf-heading mt-2 text-2xl font-bold text-white">Get Nexus Forge for Windows</h2>
            {manifestQuery.isLoading ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking the latest version…
              </p>
            ) : manifest ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Version {manifest.version} for Windows 10 and 11. Installs in a few clicks, then updates itself.
                </p>
                <a href={manifest.downloadUrl} className={cn(primaryButton, "mt-5 w-full sm:w-auto")}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Download for Windows
                </a>
                {manifest.sha256 ? (
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> SHA-256 checksum
                    </p>
                    <p className="mt-1 break-all font-mono text-xs leading-relaxed text-slate-400">{manifest.sha256}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p role="alert" className="mt-3 text-sm text-rose-200">The release manifest could not be loaded. Try again shortly.</p>
            )}
          </section>

          <section aria-labelledby="install-heading" className={card}>
            <h2 id="install-heading" className={sectionTitle}>Install in three steps</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
              <li>Press <strong className="text-white">Download for Windows</strong> and run the installer.</li>
              <li>
                If Windows shows a blue &ldquo;Windows protected your PC&rdquo; screen, choose <strong className="text-white">More info</strong>, then{" "}
                <strong className="text-white">Run anyway</strong>. The installer isn&apos;t code-signed yet.
              </li>
              <li>Sign in with your Nexus Forge account. The app keeps itself up to date after that.</li>
            </ol>
          </section>

          <section aria-labelledby="devices-heading" className="grid gap-4 md:grid-cols-2">
            <h2 id="devices-heading" className="sr-only">Other ways to play</h2>
            <div id="xbox" className={cn(card, "scroll-mt-24")}>
              <h3 className={cn(sectionTitle, "inline-flex items-center gap-2")}>
                <Gamepad2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> Play on Xbox
              </h3>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
                <li>On your Xbox, open <strong className="text-white">Microsoft Edge</strong> (it&apos;s in My games &amp; apps).</li>
                <li>Go to <strong className="text-white">nfgcord.com</strong> and sign in.</li>
                <li>Press the <strong className="text-white">Menu</strong> button and choose <strong className="text-white">Pin to Home</strong> so it opens like an app.</li>
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">A USB or Bluetooth keyboard makes typing on Xbox much faster.</p>
            </div>
            <div className={card}>
              <h3 className={cn(sectionTitle, "inline-flex items-center gap-2")}>
                <Smartphone className="h-4 w-4 text-sky-300" aria-hidden="true" /> Phone, tablet or Mac
              </h3>
              <p className="mt-3 text-sm text-slate-300">Open <strong className="text-white">nfgcord.com</strong> in your browser, then:</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                <li><strong className="text-white">Android, Chrome or Edge:</strong> menu, then <em>Install app</em></li>
                <li><strong className="text-white">iPhone or iPad:</strong> Share, then <em>Add to Home Screen</em></li>
              </ul>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className={card}>
            <h2 className={cn(sectionTitle, "inline-flex items-center gap-2")}>
              <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" /> What&apos;s new
            </h2>
            {manifest?.notes?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                {manifest.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Release notes appear here with each version.</p>
            )}
          </div>
          <div className={card}>
            <h2 className={sectionTitle}>Requirements</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
              <li>Windows 10 (1903) or Windows 11</li>
              <li>4 GB RAM and 500 MB of free disk space</li>
              <li>A microphone for voice channels</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
