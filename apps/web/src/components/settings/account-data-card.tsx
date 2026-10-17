"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { downloadAccountData, getApiErrorMessage, getDeletionStatus, requestAccountDeletion } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const inputClass =
  "h-10 w-full rounded-xl border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const ghostBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50";

/** "Download my data" and "Delete my account", at the bottom of Settings > Account. */
export function AccountDataCard() {
  const { accessToken, csrfToken, clearSession } = useAuthStore();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["account-deletion", accessToken],
    queryFn: () => getDeletionStatus(accessToken!),
    enabled: Boolean(accessToken && deleteOpen),
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadAccountData(accessToken!),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice({ tone: "ok", text: `Downloaded ${filename}.` });
    },
    onError: async (error) => {
      // The body of a failed blob request is a Blob too; read the server's message out of it.
      const data = (error as { response?: { data?: unknown } }).response?.data;
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text()) as { error?: string };
          setNotice({ tone: "error", text: parsed.error ?? "Couldn't download your data." });
          return;
        } catch {
          // fall through
        }
      }
      setNotice({ tone: "error", text: getApiErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => requestAccountDeletion(accessToken!, csrfToken!, password),
    onSuccess: () => {
      clearSession();
      window.location.href = "/login?deletion=scheduled";
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error) });
      void statusQuery.refetch();
    },
  });

  const blockers = statusQuery.data?.blockers ?? [];
  const graceDays = statusQuery.data?.graceDays ?? 14;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0d1119] p-4">
      <div>
        <p className="mb-1 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Download className="h-3.5 w-3.5" /> Your data
        </p>
        <p className="mb-3 text-xs text-slate-400">
          Download a copy of everything Nexus Forge holds for your account: profile, settings, servers, friends, messages, DMs, posts, coins, events and support tickets. Passwords and security tokens are never included.
        </p>
        <button type="button" className={ghostBtn} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
          {exportMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download my data
        </button>
      </div>

      {notice ? (
        <p className={notice.tone === "ok" ? "rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100" : "rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-100"} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="border-t border-white/5 pt-4">
        <p className="mb-1 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">
          <Trash2 className="h-3.5 w-3.5" /> Delete account
        </p>
        {!deleteOpen ? (
          <>
            <p className="mb-3 text-xs text-slate-400">Permanently delete your account. You get {graceDays} days to change your mind.</p>
            <button type="button" className={dangerBtn} onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete my account
            </button>
          </>
        ) : statusQuery.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your account...</p>
        ) : blockers.length ? (
          <div className="space-y-3">
            {blockers.map((blocker) => (
              <div key={blocker.kind} className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
                <p className="mb-2 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> {blocker.message}</p>
                <ul className="space-y-1">
                  {blocker.items.map((item) => (
                    <li key={item.id}>
                      {blocker.kind === "forges" ? (
                        <Link href={`/app/chat?forge=${item.id}&manage=danger`} className="text-amber-200 underline-offset-2 hover:underline">{item.name}</Link>
                      ) : blocker.kind === "bots" ? (
                        <Link href="/developer" className="text-amber-200 underline-offset-2 hover:underline">{item.name}</Link>
                      ) : (
                        <Link href="/app/settings?section=billing" className="text-amber-200 underline-offset-2 hover:underline">{item.name} subscription</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button type="button" className={ghostBtn} onClick={() => void statusQuery.refetch()}>Check again</button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
            <ul className="list-disc space-y-1 pl-4 text-xs text-rose-100/90">
              <li>You&apos;ll be signed out on every device straight away.</li>
              <li>Sign back in within {graceDays} days and choose &quot;Keep my account&quot; to cancel.</li>
              <li>After that your profile, friends, posts, settings and sign-in details are erased for good.</li>
              <li>Messages you sent in servers and DMs stay, shown as from &quot;deleted user&quot;.</li>
              <li>Coins, cosmetics and any purchases are lost. Consider downloading your data first.</li>
            </ul>
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Password</span>
              <input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" className="mt-0.5" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
              I understand this can&apos;t be undone after {graceDays} days.
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={dangerBtn} disabled={!password || !understood || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete my account
              </button>
              <button
                type="button"
                className={ghostBtn}
                onClick={() => {
                  setDeleteOpen(false);
                  setPassword("");
                  setUnderstood(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
