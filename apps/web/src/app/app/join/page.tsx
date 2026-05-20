"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, Users, ShieldCheck } from "lucide-react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";
import { DynamicBackground } from "@/components/ui/dynamic-background";

function extractInviteCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const direct = trimmed.toLowerCase().replace(/^\/+|\/+$/g, "");
  if (/^[a-z0-9-]{3,32}$/i.test(direct)) {
    return direct;
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const inviteIndex = segments.findIndex((segment) => segment.toLowerCase() === "invite");
    if (inviteIndex >= 0 && segments[inviteIndex + 1]) {
      const candidate = segments[inviteIndex + 1].toLowerCase();
      return /^[a-z0-9-]{3,32}$/i.test(candidate) ? candidate : "";
    }
  } catch {
    return "";
  }

  return "";
}

export default function JoinServerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const joinHeroImage = getCustomDesignImageUrl(["app-join-desktop.jpg"], "/app-hero.png");

  const inviteCode = useMemo(() => extractInviteCode(draft), [draft]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteCode) return;
    router.push(`/invite/${inviteCode}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#09040b] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(203,46,53,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(255,184,108,0.12),transparent_40%)]" />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-3 text-amber-300">
                <span className="rounded-2xl bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em]">Join Listenings</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-[#12070b] px-3 py-1 text-xs text-slate-300">
                  <Link2 className="h-3.5 w-3.5 text-amber-300" /> Live invite scan
                </span>
              </div>
              <div>
                <h1 className="text-4xl font-semibold text-white sm:text-5xl">Join a live listening room or community session.</h1>
                <p className="mt-3 text-base leading-7 text-slate-300">Paste an invite link or room code and step into shared audio spaces built for community discovery and immersive listening.</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-900/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Fast access</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-amber-300" /> Connect to live raid rooms</p>
                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-300" /> Secure invite validation</p>
                <p className="flex items-center gap-2"><Link2 className="h-4 w-4 text-amber-300" /> Push team ingress in one command</p>
              </div>
            </div>
          </div>
        </section>

        <DynamicBackground
          url={joinHeroImage}
          className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-950/85 shadow-[0_30px_80px_rgba(0,0,0,0.35)] bg-cover bg-center"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
          <div className="absolute inset-0 bg-[#09040b]/60" />
          <div className="relative p-6 text-slate-100">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Invite design</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Join experience preview</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">This page now displays your custom join-screen design if the asset exists.</p>
          </div>
        </DynamicBackground>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Invite code</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Paste the link or the code below</h2>
              </div>
              {inviteCode ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Ready</span>
              ) : (
                <span className="rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Waiting</span>
              )}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="grid gap-2 text-sm text-slate-200">
                <span className="font-medium">Invite Link or Code</span>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="https://nexusforge.app/invite/your-code or your-code"
                  className="h-14 rounded-3xl border border-slate-700/70 bg-slate-900/80 px-4 text-sm text-slate-100 outline-none focus:border-amber-500"
                />
              </label>

              {draft.trim() && !inviteCode ? (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-950/70 p-4 text-sm text-rose-200">
                  Invalid invite detected. Use a valid {"/invite/<code>"} link or plain invite code.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!inviteCode}
                  className="nexus-button-primary inline-flex h-14 items-center justify-center rounded-3xl px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue to Forge
                </button>
                <Link href="/app" className="nexus-button-secondary inline-flex h-14 items-center justify-center rounded-3xl px-6 text-sm font-semibold">
                  Back to Dashboard
                </Link>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">How it works</p>
              <ol className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-3">
                  <span className="block font-semibold text-white">1. Paste an invite</span>
                  Enter a valid invite link or code from your squad leader.
                </li>
                <li className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-3">
                  <span className="block font-semibold text-white">2. Validate instantly</span>
                  NexusForge checks the invite format and previews your target server.
                </li>
                <li className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-3">
                  <span className="block font-semibold text-white">3. Join with confidence</span>
                  Jump into the selected server with the same command center experience.
                </li>
              </ol>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Need help?</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>Invite links work best when they include a stable path: <span className="text-amber-200">/invite/</span>.</p>
                <p>If your code is invalid, ask the server owner to resend a fresh invite.</p>
                <Link href="/support" className="inline-flex rounded-full border border-amber-500/40 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-300">
                  Contact Support
                </Link>
              </div>
            </div>
          </aside>
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Ready your team",
              description: "Share the invite and bring your squad into the Forge command hub.",
              tone: "bg-amber-950/80",
            },
            {
              title: "Secure connection",
              description: "NexusForge validates invite codes before redirecting you to the server.",
              tone: "bg-amber-950/80",
            },
            {
              title: "Fast activation",
              description: "Complete setup in seconds and start chatting or voice comms immediately.",
              tone: "bg-violet-950/80",
            },
          ].map((card) => (
            <div key={card.title} className={`rounded-[32px] border border-slate-700/70 ${card.tone} p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]`}>
              <p className="text-sm font-semibold text-white">{card.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
