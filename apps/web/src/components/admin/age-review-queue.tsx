"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { BadgeCheck, Eye, FileText, Loader2, X, XCircle } from "lucide-react";
import { approveAgeReview, fetchAgeReviewFile, getAgeReviewQueue, rejectAgeReview, type AgeReviewItem, type AgeReviewStatus } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";

const documentLabels: Record<AgeReviewItem["documentType"], string> = {
  DRIVERS_LICENSE: "Driver's license",
  PASSPORT: "Passport",
  NATIONAL_ID: "National ID",
  OTHER: "Other government ID",
};

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function ageFrom(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const beforeBirthday = now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Streams a private file through the API (needs the bearer token, so no plain <img src>). */
function SecureFile({ id, kind, onClose }: { id: string; kind: "document" | "selfie"; onClose: () => void }) {
  const { accessToken } = useAuthStore();
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    fetchAgeReviewFile(accessToken!, id, kind)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setType(blob.type);
        setUrl(objectUrl);
      })
      .catch((err) => setError(errorText(err)));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, id, kind]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-3xl overflow-auto rounded-2xl border border-amber-500/20 bg-[#0d1119] p-3" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="absolute right-3 top-3 rounded-lg border border-white/10 p-1 text-slate-300 hover:text-white" onClick={onClose} title="Close">
          <X className="h-4 w-4" />
        </button>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">{kind === "selfie" ? "Selfie" : "Document"}</p>
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        {!url && !error ? <p className="text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading private file...</p> : null}
        {url && type === "application/pdf" ? <iframe src={url} title="Document" className="h-[70vh] w-full rounded-lg bg-white" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && type !== "application/pdf" ? <img src={url} alt="" className="mx-auto max-h-[70vh] rounded-lg" /> : null}
      </div>
    </div>
  );
}

export function AgeReviewQueue() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [status, setStatus] = useState<AgeReviewStatus>("PENDING");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [viewing, setViewing] = useState<{ id: string; kind: "document" | "selfie" } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const queue = useQuery({
    queryKey: ["age-review-queue", status, accessToken],
    queryFn: () => getAgeReviewQueue(accessToken!, status),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["age-review-queue"] });

  const approve = useMutation({
    mutationFn: (id: string) => approveAgeReview(accessToken!, csrfToken!, id),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Approved. The user now carries the Verified 18+ badge and the files were deleted." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectAgeReview(accessToken!, csrfToken!, id, reason || undefined),
    onSuccess: async () => {
      setRejecting(null);
      setNotice({ tone: "ok", text: "Rejected. The user was notified and the files were deleted." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const counts = queue.data?.counts ?? {};
  const items = queue.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white">ID review queue</h2>
          <p className="text-xs text-slate-400">Compare the document&apos;s date of birth with the declared one. Approving deletes the files and grants Verified 18+.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#11151e] p-1">
          {(["PENDING", "APPROVED", "REJECTED"] as AgeReviewStatus[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className={`rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status === entry ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}
              onClick={() => setStatus(entry)}
            >
              {entry.toLowerCase()} {counts[entry] ? <span className="ml-1 opacity-70">({counts[entry]})</span> : null}
            </button>
          ))}
        </div>
      </div>

      {notice ? (
        <p className={`mb-3 rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>{notice.text}</p>
      ) : null}

      {queue.isLoading ? (
        <p className="text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading queue...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-[#11151e] p-4 text-sm text-slate-400">No {status.toLowerCase()} submissions.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const declaredAge = ageFrom(item.declaredBirthdate);
            return (
              <div key={item.id} className="rounded-xl border border-white/5 bg-[#11151e] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-[#0d1119] text-sm font-bold text-amber-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.user.avatar ? <img src={item.user.avatar} alt="" className="h-full w-full object-cover" /> : item.user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">@{item.user.username}</p>
                      <p className="text-xs text-slate-400">{item.user.email} · joined {new Date(item.user.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>Submitted {new Date(item.submittedAt).toLocaleString()}</p>
                    {item.reviewedAt ? <p>Reviewed {new Date(item.reviewedAt).toLocaleString()}{item.reviewer ? ` by @${item.reviewer.username}` : ""}</p> : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-white/5 bg-[#0d1119] p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Document</p>
                    <p className="font-semibold text-white">{documentLabels[item.documentType]}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#0d1119] p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Declared date of birth</p>
                    <p className={`font-semibold ${declaredAge >= 18 ? "text-white" : "text-rose-300"}`}>{item.declaredBirthdate.slice(0, 10)} (age {declaredAge})</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#0d1119] p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Current level</p>
                    <p className="font-semibold text-white">{item.user.ageVerificationLevel}</p>
                  </div>
                </div>

                {item.rejectionReason ? <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{item.rejectionReason}</p> : null}

                {item.status === "PENDING" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" className={ghostBtn} onClick={() => setViewing({ id: item.id, kind: "document" })}><FileText className="h-3.5 w-3.5" /> View ID</button>
                    {item.hasSelfie ? <button type="button" className={ghostBtn} onClick={() => setViewing({ id: item.id, kind: "selfie" })}><Eye className="h-3.5 w-3.5" /> View selfie</button> : null}
                    <span className="flex-1" />
                    {rejecting?.id === item.id ? (
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <input className={`${inputClass} sm:w-72`} placeholder="Reason shown to the user (optional)" value={rejecting.reason} onChange={(event) => setRejecting({ id: item.id, reason: event.target.value })} />
                        <button type="button" className={`${ghostBtn} text-rose-200`} disabled={reject.isPending} onClick={() => reject.mutate({ id: item.id, reason: rejecting.reason })}>Confirm reject</button>
                        <button type="button" className={ghostBtn} onClick={() => setRejecting(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className={`${ghostBtn} text-rose-200`} onClick={() => setRejecting({ id: item.id, reason: "" })}><XCircle className="h-3.5 w-3.5" /> Reject</button>
                        <button type="button" className={goldBtn} disabled={approve.isPending || declaredAge < 18} onClick={() => window.confirm(`Approve @${item.user.username} as Verified 18+?`) && approve.mutate(item.id)}>
                          {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} Approve
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {viewing ? <SecureFile id={viewing.id} kind={viewing.kind} onClose={() => setViewing(null)} /> : null}
    </section>
  );
}
