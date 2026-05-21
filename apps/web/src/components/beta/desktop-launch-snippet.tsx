"use client";

import { useEffect, useState } from "react";

interface DesktopLaunchSnippetProps {
  desktopTarget: string;
}

export function DesktopLaunchSnippet({ desktopTarget }: DesktopLaunchSnippetProps) {
  const [status, setStatus] = useState("Copy commands");

  useEffect(() => {
    if (status === "Copied!" || status === "Copy failed") {
      const timeout = window.setTimeout(() => setStatus("Copy commands"), 2200);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [status]);

  async function handleCopy() {
    const commandText = `$env:NEXUSFORGE_DESKTOP_URL = '${desktopTarget}'\n$env:NEXUSFORGE_DESKTOP_ONLY = 'false'\nStart-Process 'C:\\Program Files\\NexusForge Desktop\\NexusForge Desktop.exe'`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(commandText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = commandText;
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!successful) {
          throw new Error("copy failed");
        }
      }
      setStatus("Copied!");
    } catch {
      setStatus("Copy failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className="nexus-glow-button inline-flex h-11 items-center justify-center rounded-xl bg-amber-500/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15"
      >
        {status}
      </button>
      {status !== "Copy commands" && (
        <span role="status" aria-live="polite" className="text-xs text-slate-300">
          {status}
        </span>
      )}
    </div>
  );
}
