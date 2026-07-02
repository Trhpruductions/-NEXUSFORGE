"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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

function statusMessage(state: DesktopUpdateState | null): string {
  if (!state) return "Desktop runtime initializing...";
  const hasActionableUpdate =
    state.forceRequired ||
    state.downloading ||
    state.downloaded ||
    state.available ||
    state.checking;
  if (state.lastError && !hasActionableUpdate) {
    return `Version ${state.currentVersion}`;
  }
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

  const shouldRenderBanner = enabled && Boolean(
    state?.lastError ||
      state?.forceRequired ||
      state?.downloading ||
      state?.downloaded ||
      state?.available,
  );

  if (!shouldRenderBanner) {
    return null;
  }

  const toneClass = state?.lastError
    ? "border-rose-500/45 bg-rose-950/35 text-rose-100"
    : state?.downloaded
      ? "border-amber-500/45 bg-amber-950/35 text-amber-100"
      : state?.available
        ? "border-amber-500/45 bg-amber-950/35 text-amber-100"
        : "border-slate-700 bg-slate-900/75 text-slate-200";

  const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;

  return (
    <div className={`pointer-events-auto fixed right-4 top-4 z-[140] w-[min(90vw,420px)] rounded-none border p-3 shadow-[0_16px_36px_rgba(2,6,23,0.45)] backdrop-blur ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Desktop Update Center</p>
      <p className="mt-1 text-sm font-medium">{statusMessage(state)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={Boolean(state?.forceRequired)}
          onClick={() => {
            if (typeof bridge?.checkUpdatesNow === "function") {
              void bridge.checkUpdatesNow().then(setState).catch(() => undefined);
            }
          }}
          variant="ghost"
          className="h-8 rounded-none px-3 text-xs"
        >
          Check now
        </Button>
        {state?.available && !state?.downloaded ? (
          <Button
            onClick={() => {
              if (typeof bridge?.downloadUpdateNow === "function") {
                void bridge.downloadUpdateNow().then(setState).catch(() => undefined);
              }
            }}
            className="h-8 rounded-none border border-amber-500/45 bg-amber-500/10 px-3 text-xs text-amber-100 hover:bg-amber-500/15"
          >
            Download update now
          </Button>
        ) : null}
        {state?.downloaded ? (
          <Button
            onClick={() => {
              if (typeof bridge?.restartForUpdate === "function") {
                void bridge.restartForUpdate();
              }
            }}
            className="h-8 rounded-none border-amber-500/55 bg-[linear-gradient(180deg,rgba(255,184,108,0.95),rgba(255,184,108,0.96)_45%,rgba(255,170,50,0.96))] px-3 text-xs text-slate-950 shadow-[0_14px_28px_rgba(255,121,63,0.24),inset_0_1px_0_rgba(255,255,255,0.28)]"
          >
            Install update now
          </Button>
        ) : null}
      </div>
    </div>
  );
}

