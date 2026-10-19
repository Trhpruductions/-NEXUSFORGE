"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { getApiErrorMessage, handleReport, listStaffReports, type ReportStatus } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";
import { SuspensionControl } from "@/components/admin/suspension-control";
import type { SuspensionInfo } from "@/lib/suspension";

const reasonLabels: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE: "Hate speech",
  SEXUAL: "Sexual content",
  VIOLENCE: "Violence",
  SELF_HARM: "Self-harm",
  SCAM: "Scam",
  OTHER: "Other",
};

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 disabled:opacity-40";
const danger = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-40";

/** Platform-wide report queue for Nexus Forge staff: every DM report, plus channel reports. */
export function StaffReports() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const queryScope = useQueryScope();
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [kind, setKind] = useState<"DM" | "CHANNEL" | "">("DM");
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Suspensions applied from this page (the report list itself doesn't carry account state).
  const [suspendedAuthors, setSuspendedAuthors] = useState<Record<string, SuspensionInfo | null>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["staff-reports", status, kind, queryScope],
    queryFn: () => listStaffReports(accessToken!, { status, kind: kind || undefined }),
    enabled: Boolean(accessToken),
  });

  const act = useMutation({
    mutationFn: (input: { id: string; status: ReportStatus; deleteMessage?: boolean }) => handleReport(accessToken!, csrfToken!, input.id, { status: input.status, deleteMessage: input.deleteMessage, note: notes[input.id]?.trim() || undefined }),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: result.messageDeleted ? "Message deleted and report resolved." : result.report.status === "OPEN" ? "Report reopened." : `Report ${result.report.status.toLowerCase()}.` });
      await queryClient.invalidateQueries({ queryKey: ["staff-reports"] });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const reports = reportsQuery.data?.reports ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={status === value ? "rounded-full border border-violet-400/50 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100" : "rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 hover:text-white"}>
            {value === "OPEN" ? `Open${reportsQuery.data ? ` (${reportsQuery.data.openCount} total)` : ""}` : value.toLowerCase()}
          </button>
        ))}
        <select aria-label="Report type" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="ml-auto h-8 rounded-lg border border-white/10 bg-[#11151e] px-2 text-xs text-slate-200">
          <option value="DM">Direct messages</option>
          <option value="CHANNEL">Server channels</option>
          <option value="">All reports</option>
        </select>
      </div>

      {notice ? <p role="status" className={notice.tone === "ok" ? "rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100" : "rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-100"}>{notice.text}</p> : null}

      {reportsQuery.isError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-100">{getApiErrorMessage(reportsQuery.error)}</p>
      ) : reportsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports...</p>
      ) : !reports.length ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="space-y-2 rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 font-semibold text-rose-100">{reasonLabels[report.reason] ?? report.reason}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5"><MessageSquare className="h-3 w-3" /> {report.kind === "DM" ? "Direct message" : "Server channel"}</span>
                <span>reported by @{report.reporter?.username ?? "deleted user"}</span>
                <span>· {new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <blockquote className="rounded-lg border border-white/[0.06] bg-[#0a0d14] px-3 py-2 text-sm text-slate-200">
                <span className="font-semibold text-white">@{report.authorUsername ?? "unknown"}</span>: <span className="whitespace-pre-wrap break-words">{report.contentSnapshot}</span>
                {report.attachmentsSnapshot.length ? <span className="mt-1 block text-[11px] text-slate-500">{report.attachmentsSnapshot.length} attachment{report.attachmentsSnapshot.length === 1 ? "" : "s"} (not shown)</span> : null}
              </blockquote>
              {report.details ? <p className="text-xs text-slate-300">Reporter&apos;s note: {report.details}</p> : null}
              {report.authorId ? (
                <SuspensionControl
                  userId={report.authorId}
                  username={report.authorUsername ?? "this user"}
                  suspension={suspendedAuthors[report.authorId] ?? null}
                  onChange={(next) => setSuspendedAuthors((current) => ({ ...current, [report.authorId!]: next }))}
                />
              ) : null}
              {report.status !== "OPEN" ? (
                <p className="text-[11px] text-slate-500">
                  {report.status.toLowerCase()} by {report.handledBy?.username ?? "staff"}
                  {report.handledAt ? ` · ${new Date(report.handledAt).toLocaleString()}` : ""}
                  {report.resolutionNote ? ` · ${report.resolutionNote}` : ""}
                </p>
              ) : (
                <input
                  value={notes[report.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                  maxLength={500}
                  placeholder="Internal note (optional)"
                  className="h-8 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-xs text-slate-100 outline-none focus:border-violet-400/60"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {report.status === "OPEN" ? (
                  <>
                    <button type="button" className={danger} disabled={act.isPending} onClick={() => act.mutate({ id: report.id, status: "RESOLVED", deleteMessage: true })}><Trash2 className="h-3.5 w-3.5" /> Delete message</button>
                    <button type="button" className={btn} disabled={act.isPending} onClick={() => act.mutate({ id: report.id, status: "RESOLVED" })}><Check className="h-3.5 w-3.5" /> Resolved</button>
                    <button type="button" className={btn} disabled={act.isPending} onClick={() => act.mutate({ id: report.id, status: "DISMISSED" })}><X className="h-3.5 w-3.5" /> Dismiss</button>
                  </>
                ) : (
                  <button type="button" className={btn} disabled={act.isPending} onClick={() => act.mutate({ id: report.id, status: "OPEN" })}><RotateCcw className="h-3.5 w-3.5" /> Reopen</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
