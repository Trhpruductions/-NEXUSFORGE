"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveAdminAgeGateAudit, getAdminAgeGateAudit, rejectAdminAgeGateAudit } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";

export function AgeGateReviewPanel() {
  const { accessToken, csrfToken } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<"blocked" | "denied" | "error" | "approved" | "rejected">("blocked");
  const [actionFilter, setActionFilter] = useState<"verify" | "reject">("verify");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const ageGateAuditQuery = useQuery({
    queryKey: ["admin-age-gate-audit", accessToken, statusFilter, actionFilter],
    queryFn: () =>
      getAdminAgeGateAudit(accessToken!, csrfToken!, {
        limit: 50,
        offset: 0,
        status: statusFilter,
        action: actionFilter,
      }),
    enabled: Boolean(accessToken && csrfToken),
    staleTime: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ auditId, note }: { auditId: string; note?: string }) =>
      approveAdminAgeGateAudit(accessToken!, csrfToken!, auditId, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-age-gate-audit", accessToken, statusFilter, actionFilter] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ auditId, note }: { auditId: string; note?: string }) =>
      rejectAdminAgeGateAudit(accessToken!, csrfToken!, auditId, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-age-gate-audit", accessToken, statusFilter, actionFilter] });
    },
  });

  return (
    <div className="grid gap-6">
      <div className="nexus-panel rounded-[24px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.24em] text-amber-700">Age Gate Review</h2>
            <p className="mt-2 text-sm text-slate-600">Inspect flagged verifications and apply manual overrides for trusted devices.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="h-9 px-3 text-xs"
              onClick={() => ageGateAuditQuery.refetch()}
              disabled={ageGateAuditQuery.isFetching}
            >
              {ageGateAuditQuery.isFetching ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            Status filter
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="mt-2 w-full rounded-[14px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="blocked">Blocked</option>
              <option value="denied">Denied</option>
              <option value="error">Error</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            Action filter
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value as typeof actionFilter)}
              className="mt-2 w-full rounded-[14px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="verify">Verify</option>
              <option value="reject">Reject</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4">
        {(ageGateAuditQuery.data?.logs ?? []).map((entry) => (
          <article key={entry.id} className="rounded-[22px] border border-slate-900/10 bg-white/85 p-5 text-sm text-slate-700 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-amber-700">{entry.action === "verify" ? "Age verification attempt" : "Age verification reject"}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-900/10 bg-slate-50 px-2 py-1">{entry.status.toUpperCase()}</span>
                <span className="rounded-full border border-slate-900/10 bg-slate-50 px-2 py-1">{entry.risk.level.toUpperCase()}</span>
                <span className="rounded-full border border-slate-900/10 bg-slate-50 px-2 py-1">{entry.action}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <p className="text-slate-600">Fingerprint: <span className="font-mono text-[11px] text-slate-500">{entry.fingerprint}</span></p>
                <p className="text-slate-600">IP: <span className="text-slate-500">{entry.ip}</span></p>
                <p className="text-slate-600">User Agent: <span className="text-slate-500 break-words">{entry.userAgent}</span></p>
                {entry.note ? <p className="text-slate-400">Note: {entry.note}</p> : null}
                {entry.risk.reasons.length ? (
                  <div className="space-y-2 text-slate-400">
                    <p className="text-sm text-slate-600">Risk drivers:</p>
                    <ul className="list-disc space-y-1 pl-5 text-slate-500">
                      {entry.risk.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {entry.deviceProfile && Object.keys(entry.deviceProfile).length ? (
                  <div className="space-y-2 text-slate-400">
                    <p className="text-sm text-slate-300">Device profile snapshot:</p>
                    <div className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                      {Object.entries(entry.deviceProfile).slice(0, 6).map(([key, value]) => (
                        <p key={key}>
                          <span className="font-semibold text-slate-600">{key}:</span> {String(value)}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <textarea
                value={reviewNotes[entry.id] ?? ""}
                onChange={(event) =>
                  setReviewNotes((previous) => ({
                    ...previous,
                    [entry.id]: event.target.value,
                  }))
                }
                placeholder="Reviewer note (optional)"
                className="min-h-[88px] w-full rounded-[14px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {entry.status === "blocked" ? (
                  <Button
                    variant="ghost"
                    className="h-10 px-3 text-xs"
                    onClick={() => approveMutation.mutate({ auditId: entry.id, note: reviewNotes[entry.id] })}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    {approveMutation.isPending ? "Approving..." : "Approve device"}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="h-10 px-3 text-xs"
                  onClick={() => rejectMutation.mutate({ auditId: entry.id, note: reviewNotes[entry.id] })}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            </div>
          </article>
        ))}

        {ageGateAuditQuery.data && ageGateAuditQuery.data.logs.length === 0 ? (
          <div className="rounded-[20px] border border-slate-900/10 bg-slate-50 p-5 text-sm text-slate-600">
            No review entries found for the selected filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}

