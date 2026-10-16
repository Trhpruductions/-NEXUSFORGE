"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Download, Loader2, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The shape the desktop main process reports through nexusforgeDesktop.getUpdateState(). */
type DesktopUpdateState = {
  checking: boolean;
  available: boolean;
  forceRequired?: boolean;
  downloading: boolean;
  downloaded: boolean;
  downloadPercent?: number;
  currentVersion: string;
  latestVersion: string | null;
  lastError: string | null;
};

type DesktopBridge = {
  runtime?: string;
  getUpdateState?: () => Promise<DesktopUpdateState>;
  checkUpdatesNow?: () => Promise<DesktopUpdateState>;
  downloadUpdateNow?: () => Promise<DesktopUpdateState>;
  restartForUpdate?: () => Promise<{ restarting: boolean }>;
  onUpdateState?: (callback: (payload: DesktopUpdateState) => void) => () => void;
};

type Busy = "check" | "download" | "restart" | null;

const panel = "vx-panel rounded-2xl p-5";

function describe(state: DesktopUpdateState): { label: string; tone: "good" | "info" | "warn" | "bad"; detail: string } {
  if (state.lastError && !state.available && !state.downloading && !state.downloaded) {
    return { label: "Couldn't check for updates", tone: "bad", detail: state.lastError };
  }
  if (state.downloaded) {
    return {
      label: "Ready to install",
      tone: "good",
      detail: `Version ${state.latestVersion ?? ""} is downloaded and verified. Restart to finish installing it.`,
    };
  }
  if (state.downloading) {
    return {
      label: "Downloading",
      tone: "info",
      detail: `Downloading version ${state.latestVersion ?? ""}. You can keep using the app while it downloads.`,
    };
  }
  if (state.available) {
    return {
      label: state.forceRequired ? "Required update" : "Update available",
      tone: state.forceRequired ? "warn" : "info",
      detail: `Version ${state.latestVersion ?? ""} is ready to download.`,
    };
  }
  if (state.checking) {
    return { label: "Checking", tone: "info", detail: "Looking for a newer version." };
  }
  return { label: "Up to date", tone: "good", detail: "You have the latest version." };
}

const toneClass: Record<"good" | "info" | "warn" | "bad", string> = {
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  warn: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  bad: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

export function DesktopUpdateCenter() {
  // undefined: still looking for the desktop bridge. null: not running in the desktop app.
  const [bridge, setBridge] = useState<DesktopBridge | null | undefined>(undefined);
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ version: string; items: string[] } | null>(null);

  useEffect(() => {
    const found = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    if (!found || found.runtime !== "electron") {
      setBridge(null);
      return;
    }
    setBridge(found);
    let active = true;
    found
      .getUpdateState?.()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) setMessage("Couldn't read the update status. Try checking for updates.");
      });
    const stop = found.onUpdateState?.((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  // Release notes come from the published manifest, so they match the version being offered.
  useEffect(() => {
    let active = true;
    fetch("/desktop-update.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { version?: unknown; notes?: unknown } | null) => {
        if (!active || !data || typeof data.version !== "string") return;
        const items = Array.isArray(data.notes) ? data.notes.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
        setNotes({ version: data.version, items });
      })
      .catch(() => {
        /* Notes are optional; the update status still works without them. */
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<unknown>) {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (bridge === undefined) {
    return <div className={cn(panel, "text-sm text-slate-400")}>Checking the desktop app…</div>;
  }

  if (bridge === null) {
    return (
      <section className={cn(panel, "space-y-2")} aria-label="Update center">
        <h2 className="text-base font-semibold text-white">Updates</h2>
        <p className="text-sm text-slate-300">
          Updates are delivered through the Windows desktop app. Install it below, and it will keep itself up to date after that.
        </p>
        <p className="text-xs text-slate-500">
          Want to see what has changed? <Link href="/app/updates" className="text-amber-300 hover:text-amber-200">Read what&apos;s new</Link>.
        </p>
      </section>
    );
  }

  const current = state;
  const status = current ? describe(current) : null;
  const percent = current && current.downloading && typeof current.downloadPercent === "number" ? Math.max(0, Math.min(100, current.downloadPercent)) : null;
  const versionForNotes = current?.latestVersion ?? current?.currentVersion ?? null;
  const showNotes = Boolean(notes && versionForNotes && notes.version === versionForNotes && notes.items.length);

  return (
    <section className={cn(panel, "space-y-4")} aria-label="Update center">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="nf-heading text-lg font-semibold text-white">Update center</h2>
          <p className="text-xs text-slate-400">Updates download in the background and install when you restart.</p>
        </div>
        {status ? (
          <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", toneClass[status.tone])}>{status.label}</span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <dt className="text-xs text-slate-400">Installed</dt>
          <dd className="mt-1 font-semibold text-white">{current ? `v${current.currentVersion}` : "…"}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <dt className="text-xs text-slate-400">Available</dt>
          <dd className="mt-1 font-semibold text-white">{current?.latestVersion ? `v${current.latestVersion}` : "None"}</dd>
        </div>
        <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-1">
          <dt className="text-xs text-slate-400">Restart needed</dt>
          <dd className="mt-1 font-semibold text-white">{current?.downloaded ? "Yes, to install" : "No"}</dd>
        </div>
      </dl>

      {status ? <p role="status" aria-live="polite" className="text-sm text-slate-300">{status.detail}</p> : null}

      {current?.downloading ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
            <div
              className={cn("h-full rounded-full bg-amber-400 transition-[width] duration-300", percent === null && "w-1/3 animate-pulse")}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{percent === null ? "Starting the download…" : `${Math.round(percent)}% downloaded`}</p>
        </div>
      ) : null}

      {message || current?.lastError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message ?? current?.lastError}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="subtle"
          onClick={() => void run("check", () => bridge.checkUpdatesNow?.() ?? Promise.resolve())}
          disabled={busy !== null || Boolean(current?.checking) || Boolean(current?.downloading)}
        >
          {busy === "check" || current?.checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Check for updates
        </Button>

        {current?.available && !current.downloaded && !current.downloading ? (
          <Button onClick={() => void run("download", () => bridge.downloadUpdateNow?.() ?? Promise.resolve())} disabled={busy !== null}>
            {busy === "download" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download update
          </Button>
        ) : null}

        {current?.downloaded ? (
          confirmRestart ? (
            <div className="flex w-full flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-slate-200">
                Restarting closes the app, so any call or screen share in progress will end. Your profile, avatar and settings are kept.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmRestart(false)} disabled={busy !== null}>
                  Not now
                </Button>
                <Button
                  onClick={() =>
                    void run("restart", async () => {
                      await bridge.restartForUpdate?.();
                    })
                  }
                  disabled={busy !== null}
                >
                  {busy === "restart" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Restart and install
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirmRestart(true)} disabled={busy !== null}>
              <RotateCw className="mr-2 h-4 w-4" />
              Restart to update
            </Button>
          )
        ) : null}

        {current?.lastError && !current.downloading ? (
          <Button
            variant="ghost"
            onClick={() =>
              current.available
                ? void run("download", () => bridge.downloadUpdateNow?.() ?? Promise.resolve())
                : void run("check", () => bridge.checkUpdatesNow?.() ?? Promise.resolve())
            }
            disabled={busy !== null}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        ) : null}
      </div>

      {showNotes && notes ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold text-white">What&apos;s in v{notes.version}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {notes.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
