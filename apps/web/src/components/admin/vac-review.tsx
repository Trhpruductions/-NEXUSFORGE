"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { getApiErrorMessage, listVacBans, reviewVacBan, type VacBanRow } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 disabled:opacity-50";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Staff queue for VAC bans: automatic bans wait here for a decision, and any active ban can be lifted. */
export function VacReview() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const query = useQuery({
    queryKey: ["vac-bans"],
    queryFn: () => listVacBans(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 30000,
  });

  const decide = useMutation({
    mutationFn: ({ banId, decision }: { banId: string; decision: "CONFIRM" | "LIFT" }) => reviewVacBan(accessToken!, csrfToken!, banId, { decision }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vac-bans"] }),
  });

  const bans: VacBanRow[] = query.data?.bans ?? [];
  const waiting = bans.filter((ban) => ban.needsReview).length;

  return (
    <section aria-labelledby="vac-review-heading" className="nexus-display-panel rounded-[24px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="vac-review-heading" className="nf-heading text-lg font-bold text-white">
          VAC bans
        </h2>
        <span className="text-xs text-slate-400">{waiting ? `${waiting} automatic ${waiting === 1 ? "ban" : "bans"} waiting for review` : `${bans.length} active`}</span>
      </div>

      {query.isPending ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading bans
        </p>
      ) : query.isError ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {getApiErrorMessage(query.error)}
        </p>
      ) : bans.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No active VAC bans.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {bans.map((ban) => (
            <li key={ban.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-white">{ban.user.username}</strong>
                <span className="rounded-full border border-rose-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200">
                  {ban.category ? ban.category.toLowerCase() : "other"}
                </span>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">{ban.source === "AUTO" ? "Automatic" : "Staff"}</span>
                {ban.needsReview ? (
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">Needs review</span>
                ) : null}
                {ban.appealedAt ? (
                  <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200">Appealed</span>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Started {formatDate(ban.createdAt)} · {ban.until ? `ends ${formatDate(ban.until)}` : "until lifted"}
              </p>
              <p className="mt-2 text-sm text-slate-200">{ban.reason}</p>
              {ban.evidence ? <p className="mt-1 text-xs text-slate-400">Evidence: {ban.evidence}</p> : null}
              {ban.appealNote ? (
                <blockquote className="mt-2 border-l-2 border-sky-400/40 pl-3 text-xs text-slate-300">Appeal: {ban.appealNote}</blockquote>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {ban.needsReview ? (
                  <button type="button" className={btn} disabled={decide.isPending} onClick={() => decide.mutate({ banId: ban.id, decision: "CONFIRM" })}>
                    <Check className="h-3.5 w-3.5" /> Confirm ban
                  </button>
                ) : null}
                <button
                  type="button"
                  className={btn}
                  disabled={decide.isPending}
                  onClick={() => {
                    if (window.confirm(`Lift the VAC ban on ${ban.user.username}?`)) decide.mutate({ banId: ban.id, decision: "LIFT" });
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Lift ban
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decide.isError ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {getApiErrorMessage(decide.error)}
        </p>
      ) : null}
    </section>
  );
}
