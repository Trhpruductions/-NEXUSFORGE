"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { BadgeCheck, Loader2, ShieldAlert } from "lucide-react";
import { attestAge } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { BirthdateForm } from "@/components/settings/age-verification";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function collectDeviceProfile() {
  const navigatorData = window.navigator as Navigator & { webdriver?: boolean; deviceMemory?: number; maxTouchPoints?: number; gpu?: unknown };
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
    browserFeatures: { hasWebGPU: typeof navigatorData.gpu !== "undefined", hasGpu: typeof navigatorData.gpu !== "undefined", hasFlash: false },
    pluginCount: navigatorData.plugins?.length ?? 0,
  };
}

export function AgeGateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams?.get("next") ?? "/app";
  const nextTarget = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  const deniedParam = searchParams?.get("denied") === "1";
  const { user, accessToken, csrfToken, fetchMe, clearSession } = useAuthStore();
  const [denied, setDenied] = useState(deniedParam);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signed-in: the date of birth is stored on the account and enforced by the API.
  const attest = useMutation({
    mutationFn: (birthdate: string) => attestAge(accessToken!, csrfToken!, birthdate),
    onSuccess: async () => {
      await fetchMe();
      router.replace(nextTarget);
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && (err.response?.data as { underage?: boolean } | undefined)?.underage) {
        clearSession();
        setDenied(true);
        return;
      }
      setError(errorText(err));
    },
  });

  // Anonymous visitor: a signed cookie remembers the 18+ confirmation for public pages.
  const confirmAnonymous = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/age/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true, deviceProfile: collectDeviceProfile() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || `Verification failed (${response.status})`);
        return;
      }
      router.replace(nextTarget);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const denyAnonymous = async () => {
    setDenied(true);
    try {
      await fetch("/api/age/reject", { method: "POST" });
    } catch {
      // best effort
    }
  };

  if (denied) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-100"><ShieldAlert className="h-4 w-4" /> You must be 18 or older to use Vexora Gaming.</p>
        <p className="mt-2 text-xs text-rose-200/80">This account cannot sign in. If you entered the wrong date of birth, contact support with proof of age.</p>
      </div>
    );
  }

  if (user && accessToken) {
    const alreadyConfirmed = user.ageVerificationLevel && user.ageVerificationLevel !== "NONE";
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#11151e] px-3 py-2 text-xs text-slate-300">
          <span>
            Signed in as <span className="font-semibold text-white">@{user.username}</span>
          </span>
          {alreadyConfirmed ? (
            <span className="inline-flex items-center gap-1 text-emerald-300"><BadgeCheck className="h-3.5 w-3.5" /> Age already confirmed</span>
          ) : null}
        </div>
        {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
        {alreadyConfirmed ? (
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300" onClick={() => router.replace(nextTarget)}>
            Continue to Vexora
          </button>
        ) : (
          <BirthdateForm busy={attest.isPending} submitLabel="Confirm and enter" onSubmit={(birthdate) => attest.mutate(birthdate)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={confirmAnonymous}
          disabled={busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} I am 18 or older
        </button>
        <button
          type="button"
          onClick={denyAnonymous}
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-lg border border-white/10 bg-[#11151e] px-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-60"
        >
          I am under 18
        </button>
      </div>
      <p className="text-xs text-slate-500">When you create an account you will enter your date of birth, and you can verify it with a government ID in Settings for the Verified 18+ badge.</p>
    </div>
  );
}
