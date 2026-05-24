"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const inviteCode = "NEXUS-BOOST";
const shareMessage = `Join NexusForge now with invite code ${inviteCode}. Launch your community with premium tools, voice rooms, and share-ready momentum.`;

export function ShareLaunchCTA() {
  const [status, setStatus] = useState("Copy invite");

  useEffect(() => {
    if (status === "Copied!") {
      const timeout = window.setTimeout(() => setStatus("Copy invite"), 2200);
      return () => window.clearTimeout(timeout);
    }
  }, [status]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareMessage;
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
    <section className="share-launch-card reveal-section rounded-[28px] border border-amber-500/20 bg-slate-950/80 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.32)]">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Squad share</p>
          <h2 className="mt-2 text-3xl font-[family-name:var(--font-orbitron)] text-slate-50 sm:text-4xl">
            Make this launch the story everyone shares.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Give your community an invite-first experience with an instantly copyable launch code, share prompts, and premium momentum.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="nexus-glow-button inline-flex h-12 items-center rounded-2xl px-6 text-sm font-semibold text-amber-50 transition hover:-translate-y-0.5"
            >
              Copy invite
            </button>
            {status !== "Copy invite" && (
              <span
                role="status"
                aria-live="polite"
                className="share-launch-status rounded-full bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/20"
              >
                {status}
              </span>
            )}
            <Link
              href="/app"
              className="nexus-outline-button inline-flex h-12 items-center rounded-2xl px-6 text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5"
            >
              Open the hub
            </Link>
          </div>
        </div>
        <div className="grid gap-3 rounded-3xl border border-slate-700/70 bg-slate-900/75 p-5 text-slate-200 shadow-[0_24px_50px_rgba(2,6,23,0.24)]">
          <div className="share-launch-pill rounded-3xl bg-slate-950/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Invite code</p>
            <p className="mt-2 text-lg font-semibold text-white">{inviteCode}</p>
          </div>
          <div className="grid gap-2">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Share prompts</p>
            <p className="text-sm text-slate-300">“Join NexusForge and launch your squad with the premium guild toolkit.”</p>
            <p className="text-sm text-slate-300">“This is the launch experience your crew needs for live rooms, boosts, and real momentum.”</p>
          </div>
        </div>
      </div>
    </section>
  );
}
