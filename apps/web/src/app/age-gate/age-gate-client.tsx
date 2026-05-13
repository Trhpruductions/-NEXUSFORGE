"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AgeGateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNextTarget = searchParams.get("next") || "/app";
  const nextTarget = rawNextTarget.startsWith("/") && !rawNextTarget.startsWith("//") ? rawNextTarget : "/app";
  const [status, setStatus] = useState<"idle" | "submitting" | "denied" | "error">("idle");

  const confirm18 = async () => {
    setStatus("submitting");
    try {
      const response = await fetch("/api/age/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      router.replace(nextTarget);
    } catch {
      setStatus("error");
    }
  };

  const deny = async () => {
    setStatus("denied");
    try {
      await fetch("/api/age/reject", { method: "POST" });
    } catch {
      // Best effort cookie clear.
    }
  };

  return (
    <section className="nexus-panel-strong rounded-3xl p-6 sm:p-8">
      <p className="nexus-eyebrow text-rose-300">Age Verification</p>
      <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-white sm:text-3xl">
        NexusForge is 18+ only
      </h1>
      <p className="mt-3 text-sm text-slate-300">
        Access is restricted to users aged 18 or older. Verification is enforced server-side.
      </p>

      {status === "denied" ? (
        <div className="mt-4 rounded-2xl border border-rose-500/35 bg-rose-950/25 p-4 text-sm text-rose-200">
          Access denied. You must be 18+ to use NexusForge.
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-950/25 p-4 text-sm text-amber-200">
          Verification failed. Try again.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={confirm18}
          disabled={status === "submitting" || status === "denied"}
          className="nexus-glow-button inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Verifying..." : "I am 18+"}
        </button>
        <button
          type="button"
          onClick={deny}
          disabled={status === "submitting" || status === "denied"}
          className="nexus-outline-button inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          I am under 18
        </button>
        <Link href="/" className="nexus-outline-button inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-slate-200">
          Back home
        </Link>
      </div>
    </section>
  );
}
