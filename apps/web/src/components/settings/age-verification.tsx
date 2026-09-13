"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { BadgeCheck, CalendarDays, FileUp, IdCard, Loader2, ShieldAlert, ShieldCheck, Trash2, UserCheck, X } from "lucide-react";
import { attestAge, getAgeSummary, submitAgeDocument, withdrawAgeSubmission, type AgeDocumentType, type AgeSummary } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const documentTypes: Array<{ value: AgeDocumentType; label: string }> = [
  { value: "DRIVERS_LICENSE", label: "Driver's license" },
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID card" },
  { value: "OTHER", label: "Other government ID" },
];

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function isUnderageError(error: unknown) {
  return axios.isAxiosError(error) && Boolean((error.response?.data as { underage?: boolean } | undefined)?.underage);
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function levelLabel(level: AgeSummary["level"] | undefined) {
  if (level === "VERIFIED") return "Verified 18+";
  if (level === "ATTESTED") return "18+ declared";
  return "Not confirmed";
}

function LevelPill({ level }: { level: AgeSummary["level"] }) {
  const tone =
    level === "VERIFIED"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : level === "ATTESTED"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
        : "border-rose-400/40 bg-rose-500/10 text-rose-200";
  const Icon = level === "VERIFIED" ? BadgeCheck : level === "ATTESTED" ? UserCheck : ShieldAlert;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
      <Icon className="h-3 w-3" /> {levelLabel(level)}
    </span>
  );
}

/** Date-of-birth form shared by the gate page and the settings card. */
export function BirthdateForm({
  initial,
  busy,
  submitLabel = "Confirm my age",
  onSubmit,
}: {
  initial?: string | null;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (birthdate: string) => void;
}) {
  const [birthdate, setBirthdate] = useState(initial ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) && birthdate < today;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && confirmed) onSubmit(birthdate);
      }}
    >
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Date of birth</span>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300" />
          <input
            className={`${inputClass} pl-9 [color-scheme:dark]`}
            type="date"
            name="birthdate"
            max={today}
            min="1900-01-01"
            value={birthdate}
            onChange={(event) => setBirthdate(event.target.value)}
            required
          />
        </div>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#11151e] accent-amber-400" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I confirm this date of birth is accurate and that I am 18 or older. Giving a false date is grounds for a permanent ban.</span>
      </label>
      <button type="submit" className={goldBtn} disabled={!valid || !confirmed || busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} {submitLabel}
      </button>
    </form>
  );
}

export function AgeVerificationCard({ highlight = false }: { highlight?: boolean }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, fetchMe, clearSession } = useAuthStore();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [documentType, setDocumentType] = useState<AgeDocumentType>("DRIVERS_LICENSE");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const documentInput = useRef<HTMLInputElement | null>(null);
  const selfieInput = useRef<HTMLInputElement | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["age-summary", accessToken],
    queryFn: () => getAgeSummary(accessToken!),
    enabled: Boolean(accessToken),
  });
  const summary = summaryQuery.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["age-summary"] });
    await fetchMe();
  };

  const attest = useMutation({
    mutationFn: (birthdate: string) => attestAge(accessToken!, csrfToken!, birthdate),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Thanks. Your date of birth is on file and you are marked 18+." });
      await refresh();
    },
    onError: (error) => {
      if (isUnderageError(error)) {
        clearSession();
        window.location.assign("/age-gate?denied=1");
        return;
      }
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!documentFile) throw new Error("Attach a photo of your ID");
      if (documentFile.size > MAX_FILE_BYTES || (selfieFile && selfieFile.size > MAX_FILE_BYTES)) throw new Error("Files must be 8 MB or smaller");
      const document = await readAsDataUrl(documentFile);
      const selfie = selfieFile ? await readAsDataUrl(selfieFile) : undefined;
      return submitAgeDocument(accessToken!, csrfToken!, { documentType, document, selfie });
    },
    onSuccess: async () => {
      setDocumentFile(null);
      setSelfieFile(null);
      if (documentInput.current) documentInput.current.value = "";
      if (selfieInput.current) selfieInput.current.value = "";
      setNotice({ tone: "ok", text: "Your ID was submitted. A Vexora reviewer will check it and you will get a notification with the result." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawAgeSubmission(accessToken!, csrfToken!),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Submission withdrawn and the uploaded files were deleted." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  if (!summary) {
    return (
      <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4 text-sm text-slate-400">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading age verification...
      </div>
    );
  }

  const pending = summary.review?.status === "PENDING" ? summary.review : null;
  const rejected = summary.review?.status === "REJECTED" ? summary.review : null;
  const needsAttention = summary.level === "NONE";

  return (
    <section className={`rounded-2xl border bg-[#0d1119] p-4 ${highlight && needsAttention ? "border-amber-400/60 shadow-[0_0_30px_rgba(230,179,37,0.2)]" : "border-amber-500/15"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="nf-heading inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">
            <IdCard className={`h-4 w-4 ${summary.level === "VERIFIED" ? "text-emerald-300" : "text-amber-300"}`} /> Age Verification
          </h2>
          <p className="text-xs text-slate-400">Vexora Gaming is 18+. Declare your date of birth to play, and verify with a government ID to unlock prize tournaments and the Verified badge.</p>
        </div>
        <LevelPill level={summary.level} />
      </div>

      {notice ? (
        <p className={`mb-3 rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>{notice.text}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Step 1: date of birth */}
        <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><CalendarDays className="h-4 w-4 text-amber-300" /> Step 1 · Date of birth</p>
            <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${summary.level === "NONE" ? "text-rose-300" : "text-emerald-300"}`}>{summary.level === "NONE" ? "Required" : "Done"}</span>
          </div>
          {summary.level === "VERIFIED" ? (
            <p className="text-xs text-slate-300">
              On file: <span className="font-semibold text-white">{summary.birthdate}</span> (age {summary.age}). Locked because it was confirmed against your ID.
            </p>
          ) : (
            <>
              {summary.birthdate ? (
                <p className="mb-2 text-xs text-slate-400">
                  On file: <span className="font-semibold text-white">{summary.birthdate}</span> (age {summary.age}). Update it below if it is wrong.
                </p>
              ) : (
                <p className="mb-2 text-xs text-slate-400">No date of birth on file yet. You cannot use the store, mining, jackpots, or go live until this is done.</p>
              )}
              <BirthdateForm initial={summary.birthdate} busy={attest.isPending} submitLabel={summary.birthdate ? "Update date of birth" : "Confirm my age"} onSubmit={(value) => attest.mutate(value)} />
            </>
          )}
        </div>

        {/* Step 2: ID */}
        <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><IdCard className="h-4 w-4 text-amber-300" /> Step 2 · Government ID</p>
            <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${summary.level === "VERIFIED" ? "text-emerald-300" : pending ? "text-amber-300" : "text-slate-500"}`}>
              {summary.level === "VERIFIED" ? "Verified" : pending ? "In review" : "Optional"}
            </span>
          </div>

          {summary.level === "VERIFIED" ? (
            <p className="text-xs text-emerald-200">
              Your ID was approved{summary.verifiedAt ? ` on ${new Date(summary.verifiedAt).toLocaleDateString()}` : ""}. The document was deleted after review. You carry the Verified 18+ badge and can host prize tournaments.
            </p>
          ) : pending ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Submitted {new Date(pending.submittedAt).toLocaleString()} ({documentTypes.find((entry) => entry.value === pending.documentType)?.label}). A reviewer will check it shortly.
              </p>
              <button type="button" className={`${ghostBtn} text-rose-200`} disabled={withdraw.isPending} onClick={() => window.confirm("Withdraw your submission and delete the uploaded files?") && withdraw.mutate()}>
                <Trash2 className="h-3.5 w-3.5" /> Withdraw
              </button>
            </div>
          ) : summary.level === "NONE" ? (
            <p className="text-xs text-slate-400">Confirm your date of birth first, then you can submit an ID.</p>
          ) : (
            <div className="space-y-2">
              {rejected ? (
                <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  Last submission was rejected{rejected.reviewedAt ? ` on ${new Date(rejected.reviewedAt).toLocaleDateString()}` : ""}: {rejected.rejectionReason}
                </p>
              ) : null}
              <p className="text-xs text-slate-400">Upload a clear photo of a valid government ID showing your date of birth. Files are stored privately on the server, seen only by the reviewer, and deleted after the decision.</p>
              <select className={inputClass} value={documentType} onChange={(event) => setDocumentType(event.target.value as AgeDocumentType)}>
                {documentTypes.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-amber-400/30 bg-[#0d1119] px-3 py-4 text-center text-xs text-slate-300 hover:border-amber-400/60">
                  <FileUp className="h-5 w-5 text-amber-300" />
                  <span className="font-semibold text-white">{documentFile ? documentFile.name : "ID photo"}</span>
                  <span className="text-[10px] text-slate-500">JPG, PNG, WEBP or PDF · up to 8 MB</span>
                  <input ref={documentInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 bg-[#0d1119] px-3 py-4 text-center text-xs text-slate-300 hover:border-amber-400/60">
                  <UserCheck className="h-5 w-5 text-amber-300" />
                  <span className="font-semibold text-white">{selfieFile ? selfieFile.name : "Selfie holding the ID"}</span>
                  <span className="text-[10px] text-slate-500">Optional · speeds up review</span>
                  <input ref={selfieInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={goldBtn} disabled={!documentFile || submit.isPending} onClick={() => submit.mutate()}>
                  {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} Submit for review
                </button>
                {documentFile || selfieFile ? (
                  <button
                    type="button"
                    className={ghostBtn}
                    onClick={() => {
                      setDocumentFile(null);
                      setSelfieFile(null);
                      if (documentInput.current) documentInput.current.value = "";
                      if (selfieInput.current) selfieInput.current.value = "";
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
