"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Scale } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api";
import { acceptPolicies, getPendingConsents } from "@/lib/legal-api";
import { useAuthStore } from "@/store/auth-store";

/**
 * Shown inside the app when a required policy has a version this person hasn't accepted
 * (new account from before the policy existed, or a material update). Each policy gets
 * its own unticked box; nothing is assumed from continuing to use the app.
 */
export function ConsentRenewal() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, clearSession } = useAuthStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const pendingQuery = useQuery({
    queryKey: ["legal-pending", accessToken],
    queryFn: () => getPendingConsents(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
  });
  const pending = pendingQuery.data?.pending ?? [];

  const acceptMutation = useMutation({
    mutationFn: () => acceptPolicies(accessToken!, csrfToken!, pending.map((policy) => policy.versionId)),
    onSuccess: (data) => {
      queryClient.setQueryData(["legal-pending", accessToken], { pending: data.pending });
      setChecked({});
    },
  });

  if (!pending.length) return null;
  const ready = pending.every((policy) => checked[policy.versionId]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-violet-400/30 bg-[#0d1119] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/70 via-amber-400/80 to-cyan-400/70" />
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Scale className="h-5 w-5" /></span>
            <div>
              <h2 id="consent-title" className="text-base font-semibold text-white">We&apos;ve updated our policies</h2>
              <p className="text-sm text-slate-400">Please review and accept to keep using Vexora Gaming.</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {pending.map((policy) => (
              <label key={policy.versionId} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#11151e] p-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-400"
                  checked={Boolean(checked[policy.versionId])}
                  onChange={(event) => setChecked((current) => ({ ...current, [policy.versionId]: event.target.checked }))}
                />
                <span>
                  {policy.consentText}{" "}
                  <Link href={`/legal/${policy.slug}`} target="_blank" className="font-semibold text-sky-300 underline-offset-2 hover:underline">
                    Read it
                  </Link>
                </span>
              </label>
            ))}
          </div>
          {acceptMutation.isError ? <p role="alert" className="text-xs text-rose-300">{getApiErrorMessage(acceptMutation.error)}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                clearSession();
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out instead
            </button>
            <button
              type="button"
              disabled={!ready || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-950 transition hover:brightness-110 disabled:opacity-40"
            >
              {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Accept and continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
