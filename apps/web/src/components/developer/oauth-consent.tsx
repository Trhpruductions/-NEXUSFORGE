"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, KeyRound, Loader2 } from "lucide-react";
import { api, authHeaders, getApiErrorMessage } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

type AppInfo = { name: string; developer: string; createdAt: string; redirectHost: string };

/**
 * "Sign in with Nexus Forge" approval: shows which app is asking, who made it and what it gets.
 * Nothing is shared until you press Allow.
 */
export function OAuthConsent() {
  const params = useSearchParams();
  const { accessToken, csrfToken, user, hydrated } = useAuthStore();
  const queryScope = useQueryScope();
  const request = {
    response_type: params?.get("response_type") ?? "code",
    client_id: params?.get("client_id") ?? "",
    redirect_uri: params?.get("redirect_uri") ?? "",
    scope: params?.get("scope") ?? undefined,
    state: params?.get("state") ?? undefined,
  };
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ["oauth-app", request.client_id, request.redirect_uri, queryScope],
    queryFn: async () =>
      (await api.get<{ app: AppInfo }>("/api/oauth/authorize/info", { headers: authHeaders(accessToken), params: { client_id: request.client_id, redirect_uri: request.redirect_uri } })).data.app,
    enabled: Boolean(accessToken && request.client_id && request.redirect_uri),
    retry: false,
  });

  const decide = async (choice: "allow" | "deny") => {
    if (!accessToken || !csrfToken) return;
    setBusy(choice);
    setError(null);
    try {
      const { data } = await api.post<{ redirect: string }>(`/api/oauth/authorize/${choice === "allow" ? "approve" : "deny"}`, request, { headers: authHeaders(accessToken, csrfToken) });
      window.location.assign(data.redirect);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setBusy(null);
    }
  };

  const here = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/oauth/authorize";

  return (
    <div className="flex min-h-app items-center justify-center bg-[#040812] px-4 py-10 text-slate-100">
      <main id="main-content" className="w-full max-w-md rounded-2xl border border-violet-400/25 bg-[#0d0a18] p-6 shadow-[0_0_60px_rgba(139,92,246,0.12)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/10 text-violet-200"><KeyRound className="h-6 w-6" /></span>
        {!hydrated ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : !user ? (
          <>
            <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Sign in to continue</h1>
            <p className="mt-2 text-sm text-slate-400">An app wants to connect to your Nexus Forge Gaming account. Sign in first, then you&apos;ll be asked to allow it.</p>
            <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="mt-5 inline-block rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400">Sign in</Link>
          </>
        ) : info.isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking the app…</p>
        ) : info.isError || !info.data ? (
          <>
            <h1 className="nf-heading mt-4 text-2xl font-bold text-white">This link doesn&apos;t work</h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {info.error ? getApiErrorMessage(info.error) : "The app or its return address isn't valid."}</p>
            <Link href="/app" className="mt-5 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200">Back to Nexus Forge</Link>
          </>
        ) : (
          <>
            <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Allow {info.data.name}?</h1>
            <p className="mt-1 text-sm text-slate-400">
              Made by <strong className="text-slate-200">@{info.data.developer}</strong> · will return you to <strong className="text-slate-200">{info.data.redirectHost}</strong>
            </p>
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-4 text-sm text-slate-200">
              <p className="font-semibold text-amber-100">It will be able to use Nexus Forge as you ({user.username}):</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>• see your profile, friends and servers</li>
                <li>• read and send messages in places you can</li>
                <li>• act on your behalf until the access expires</li>
              </ul>
              <p className="mt-2 text-xs text-slate-400">Only allow apps you trust. Nexus Forge never shares your password.</p>
            </div>
            {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => void decide("allow")} disabled={busy !== null} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-50">
                {busy === "allow" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Allow
              </button>
              <button type="button" onClick={() => void decide("deny")} disabled={busy !== null} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-white/25 disabled:opacity-50">
                {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cancel
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
