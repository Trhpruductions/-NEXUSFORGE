"use client";

import { useEffect, useMemo, useState } from "react";
import { DesktopLaunchSnippet } from "@/components/beta/desktop-launch-snippet";

interface DesktopLaunchInstructionsProps {
  envAppUrl?: string;
}

const defaultFallback = "https://your-beta-host.example.com/app";

function resolveDesktopTarget(value: string): string {
  const normalized = value.replace(/\/+$/u, "");
  return normalized.endsWith("/app") ? normalized : `${normalized}/app`;
}

export function DesktopLaunchInstructions({ envAppUrl }: DesktopLaunchInstructionsProps) {
  const [desktopTarget, setDesktopTarget] = useState(() => {
    if (envAppUrl) {
      return resolveDesktopTarget(envAppUrl);
    }
    return defaultFallback;
  });

  useEffect(() => {
    if (!envAppUrl && typeof window !== "undefined") {
      setDesktopTarget(resolveDesktopTarget(window.location.origin));
    }
  }, [envAppUrl]);

  const commandText = useMemo(
    () =>
      `$env:NEXUSFORGE_DESKTOP_URL = '${desktopTarget}'\n$env:NEXUSFORGE_DESKTOP_ONLY = 'false'\nStart-Process 'C:\\Program Files\\NexusForge Desktop\\NexusForge Desktop.exe'`,
    [desktopTarget],
  );

  const hintText = envAppUrl
    ? "Your configured beta host is used as the desktop launch target."
    : "If no environment target is configured, this page will update to your browser host once hydrated.";

  return (
    <div className="mt-8 rounded-none border border-slate-700/70 bg-slate-900/90 p-5 text-sm text-slate-200">
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Desktop launch instructions</p>
      <p className="mt-3 text-slate-300">
        To use the full desktop experience, install the beta desktop client and launch it with the following target.
      </p>
      <div className="mt-4 rounded-none border border-slate-700/70 bg-slate-950/90 p-4 text-xs font-mono text-slate-200">
        <p className="mb-2">Desktop launch target:</p>
        <p className="break-all text-sm text-amber-200">{desktopTarget}</p>
      </div>
      <div className="mt-4 rounded-none border border-slate-700/70 bg-slate-950/90 p-4 text-xs font-mono text-slate-200">
        <p className="mb-2">Use these PowerShell commands:</p>
        <pre className="whitespace-pre-wrap break-all text-sm">{commandText}</pre>
      </div>
      <p className="mt-3 text-sm text-slate-400">{hintText}</p>
      <DesktopLaunchSnippet desktopTarget={desktopTarget} />
      <p className="mt-4 text-slate-400">
        If the desktop app is installed somewhere else, replace the executable path with the actual install location.
      </p>
    </div>
  );
}
