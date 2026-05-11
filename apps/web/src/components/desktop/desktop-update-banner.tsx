"use client";

import { useEffect, useState } from "react";

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
  restartForUpdate?: () => Promise<{ restarting: boolean }>;
  onUpdateState?: (callback: (payload: DesktopUpdateState) => void) => () => void;
};

function statusMessage(state: DesktopUpdateState | null): string {
  if (!state) return "Desktop runtime initializing...";
  if (state.lastError) return state.lastError;
  if (state.forceRequired && state.downloaded) {
    return `Required update ${state.latestVersion ?? ""} downloaded. Installing now.`;
  }
  if (state.downloading) {
    const pct = typeof state.downloadPercent === "number" && state.downloadPercent > 0 ? ` (${state.downloadPercent}%)` : "";
    const required = state.forceRequired ? "Required " : "";
    return `${required}downloading update ${state.latestVersion ?? ""}${pct}...`;
  }
  if (state.downloaded) return `Update ${state.latestVersion ?? ""} downloaded. Restart to install.`;
  if (state.available && state.forceRequired) return `Required update available: ${state.latestVersion ?? ""}`;
  if (state.available) return `Update available: ${state.latestVersion ?? ""}`;
  if (state.checking) return "Checking for updates...";
  return `Version ${state.currentVersion}`;
}

export function DesktopUpdateBanner() {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    if (!bridge || bridge.runtime !== "electron") {
      return;
    }

    setEnabled(true);

    if (typeof bridge.getUpdateState === "function") {
      void bridge.getUpdateState().then(setState).catch(() => undefined);
    }

    const dispose =
      typeof bridge.onUpdateState === "function"
        ? bridge.onUpdateState((payload) => {
            setState(payload);
          })
        : undefined;

    return () => {
      if (typeof dispose === "function") {
        dispose();
      }
    };
  }, []);

  if (!enabled) {
    return null;
  }

  const toneClass = state?.lastError
    ? "border-rose-500/45 bg-rose-950/35 text-rose-100"
    : state?.downloaded
      ? "border-emerald-500/45 bg-emerald-950/35 text-emerald-100"
      : state?.available
        ? "border-cyan-500/45 bg-cyan-950/35 text-cyan-100"
        : "border-slate-700 bg-slate-900/75 text-slate-200";

  const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;

  return (
    <div className={`pointer-events-auto fixed right-4 top-4 z-[120] w-[min(90vw,420px)] rounded-2xl border p-3 shadow-[0_16px_36px_rgba(2,6,23,0.45)] backdrop-blur ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Desktop Update Center</p>
      <p className="mt-1 text-sm font-medium">{statusMessage(state)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(state?.forceRequired)}
          onClick={() => {
            if (typeof bridge?.checkUpdatesNow === "function") {
              void bridge.checkUpdatesNow().then(setState).catch(() => undefined);
            }
          }}
          className="rounded-lg border border-slate-600 bg-slate-900/65 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-500/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Check now
        </button>
        {state?.downloaded ? (
          <button
            type="button"
            onClick={() => {
              if (typeof bridge?.restartForUpdate === "function") {
                void bridge.restartForUpdate();
              }
            }}
            className="rounded-lg border border-emerald-500/55 bg-emerald-950/45 px-3 py-1.5 text-xs font-semibold text-emerald-100"
          >
            Install update now
          </button>
        ) : null}
      </div>
    </div>
  );
}
