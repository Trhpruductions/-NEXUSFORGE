"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AgeGateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNextTarget = searchParams ? searchParams.get("next") ?? "/app" : "/app";
  const nextTarget = rawNextTarget.startsWith("/") && !rawNextTarget.startsWith("//") ? rawNextTarget : "/app";
  const [status, setStatus] = useState<"idle" | "submitting" | "denied" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const collectDeviceProfile = () => {
    const navigatorData = window.navigator as Navigator & {
      webdriver?: boolean;
      deviceMemory?: number;
      maxTouchPoints?: number;
      gpu?: unknown;
    };

    return {
      userAgent: navigatorData.userAgent,
      platform: navigatorData.platform,
      vendor: navigatorData.vendor,
      language: navigatorData.language,
      languages: navigatorData.languages,
      hardwareConcurrency: navigatorData.hardwareConcurrency,
      deviceMemory: navigatorData.deviceMemory,
      cookieEnabled: navigatorData.cookieEnabled,
      webdriver: navigatorData.webdriver,
      screenWidth: window.screen?.width,
      screenHeight: window.screen?.height,
      colorDepth: window.screen?.colorDepth,
      touchPoints: navigatorData.maxTouchPoints,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      browserFeatures: {
        hasWebGPU: typeof navigatorData.gpu !== "undefined",
        hasGpu: typeof navigatorData.gpu !== "undefined",
        hasFlash: typeof navigatorData.plugins !== "undefined" && navigatorData.plugins.length > 0,
      },
      pluginCount: navigatorData.plugins?.length ?? 0,
    };
  };

  const confirm18 = async () => {
    setStatus("submitting");
    const deviceProfile = collectDeviceProfile();

    try {
      const response = await fetch("/api/age/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true, deviceProfile }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          manualReview?: boolean;
          riskScore?: number;
          reason?: string[];
        } | null;
        setErrorMessage(
          payload?.manualReview
            ? `Verification paused for review (${payload?.riskScore ?? "?"}). ${payload?.error ?? ""}`
            : payload?.error || `Verification failed (${response.status})`,
        );
        setStatus("error");
        return;
      }
      router.replace(nextTarget);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Verification request failed.");
      setStatus("error");
    }
  };

  const deny = async () => {
    setStatus("denied");
    try {
      await fetch("/api/age/reject", { method: "POST" });
    } catch {
      // Best effort.
    }
  };

  return (
    <section className="rounded-none border border-amber-500/20 bg-slate-950/95 p-8">
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Secure access</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">One verification. One entry.</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Use the gate below to verify your age and unlock NexusForge. This is the only access flow for the platform.
          </p>
        </div>

        {status === "error" ? (
          <div className="rounded-none border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
            {errorMessage ?? "Verification failed. Please try again."}
          </div>
        ) : null}

        {status === "denied" ? (
          <div className="rounded-none border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-200">
            Access denied. You must be 18+ to use NexusForge.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={confirm18}
            disabled={status === "submitting" || status === "denied"}
            className="inline-flex h-14 items-center justify-center rounded-none bg-amber-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Verifying…" : "I am 18+"}
          </button>
          <button
            type="button"
            onClick={deny}
            disabled={status === "submitting" || status === "denied"}
            className="inline-flex h-14 items-center justify-center rounded-none border border-slate-700/70 bg-slate-900 px-6 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            I am under 18
          </button>
        </div>

        <div className="rounded-none border border-slate-700/70 bg-slate-900/90 p-4 text-sm text-slate-300">
          <p className="font-medium text-white">Need support?</p>
          <p className="mt-2">If you want details about age verification, review our policies or contact support.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/support" className="text-amber-300 underline decoration-amber-400/40 underline-offset-4 hover:text-white">
              Support
            </Link>
            <Link href="/terms" className="text-amber-300 underline decoration-amber-400/40 underline-offset-4 hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
