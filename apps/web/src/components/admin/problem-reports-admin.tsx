"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, RefreshCcw, RotateCcw, User } from "lucide-react";
import { getApiErrorMessage, listProblemReports, setProblemReportStatus, type ProblemReportRow } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const KIND_LABEL: Record<ProblemReportRow["kind"], { label: string; tone: string }> = {
  BUG: { label: "Broken", tone: "border-rose-400/30 text-rose-200" },
  SIGN_IN: { label: "Can't sign in", tone: "border-amber-400/30 text-amber-200" },
  BILLING: { label: "Payments", tone: "border-emerald-400/30 text-emerald-200" },
  SAFETY: { label: "Safety", tone: "border-violet-400/30 text-violet-200" },
  OTHER: { label: "Other", tone: "border-white/15 text-slate-300" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Staff: reports from the website's "Report a problem" form. */
export function ProblemReportsAdmin() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["problem-reports", status, accessToken],
    queryFn: () => listProblemReports(accessToken!, status),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  const update = useMutation({
    mutationFn: (payload: { id: string; status: "OPEN" | "RESOLVED" }) => setProblemReportStatus(accessToken!, csrfToken!, payload.id, payload.status),
    onSuccess: async () => {
      setNotice(null);
      await queryClient.invalidateQueries({ queryKey: ["problem-reports"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const tab = (value: typeof status, label: string) => (
    <button
      type="button"
      onClick={() => setStatus(value)}
      aria-pressed={status === value}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === value ? "bg-amber-400 text-slate-950" : "border border-white/10 text-slate-300 hover:border-white/25"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tab("OPEN", `Open${query.data ? ` (${query.data.open})` : ""}`)}
        {tab("RESOLVED", "Resolved")}
        {tab("ALL", "All")}
        <button type="button" onClick={() => void query.refetch()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/25">
          <RefreshCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {notice ? <p className="text-xs text-rose-300">{notice}</p> : null}

      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-rose-300">{getApiErrorMessage(query.error)}</p>
      ) : !query.data?.reports.length ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-5 text-sm text-emerald-100">
          <Check className="mb-2 h-5 w-5" /> {status === "OPEN" ? "No open reports. All caught up." : "Nothing here yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {query.data.reports.map((report) => {
            const kind = KIND_LABEL[report.kind] ?? KIND_LABEL.OTHER;
            const replyTo = report.user?.email ?? report.contactEmail;
            return (
              <li key={report.id} className="rounded-xl border border-white/10 bg-[#0d1119] p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 font-semibold ${kind.tone}`}>{kind.label}</span>
                  <span className="text-slate-500">{when(report.createdAt)}</span>
                  <span className="text-slate-600">· ref {report.id.slice(0, 8).toUpperCase()}</span>
                  {report.status === "RESOLVED" ? <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-emerald-200">Resolved</span> : null}
                  <span className="ml-auto">
                    {report.status === "OPEN" ? (
                      <button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: report.id, status: "RESOLVED" })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 px-2 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> Resolved
                      </button>
                    ) : (
                      <button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: report.id, status: "OPEN" })} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-slate-300 hover:border-white/25 disabled:opacity-50">
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-100">{report.message}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {report.user ? `@${report.user.username}` : "Not signed in"}</span>
                  {replyTo ? (
                    <a href={`mailto:${replyTo}?subject=${encodeURIComponent("About your Nexus Forge Gaming report")}`} className="inline-flex items-center gap-1 text-amber-200 hover:text-white">
                      <Mail className="h-3 w-3" /> {replyTo}
                    </a>
                  ) : (
                    <span>No email left</span>
                  )}
                  {report.pageUrl ? <span>Page: {report.pageUrl}</span> : null}
                  {report.userAgent ? <span className="max-w-full truncate" title={report.userAgent}>{report.userAgent}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
