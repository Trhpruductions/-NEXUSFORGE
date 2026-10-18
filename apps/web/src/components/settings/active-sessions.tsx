"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Laptop, Loader2, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { getApiErrorMessage, revokeOtherSessions, revokeSession, type ActiveSession } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

function DeviceIcon({ label }: { label: string }) {
  const cls = "h-4 w-4";
  if (/iPhone|Android/.test(label)) return <Smartphone className={cls} />;
  if (/iPad/.test(label)) return <Tablet className={cls} />;
  if (/Nexus Forge Desktop/.test(label)) return <Monitor className={cls} />;
  return <Laptop className={cls} />;
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return "active now";
  if (minutes < 60) return `active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `active ${hours} h ago`;
  return `active ${Math.round(hours / 24)} d ago`;
}

export function ActiveSessions({ sessions, onChanged }: { sessions: ActiveSession[]; onChanged: () => void }) {
  const { accessToken, csrfToken, clearSession } = useAuthStore();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const revokeOne = useMutation({
    mutationFn: (session: ActiveSession) => revokeSession(accessToken!, csrfToken!, session.id),
    onSuccess: (_data, session) => {
      if (session.current) {
        // Signing out this browser's own session.
        clearSession();
        window.location.href = "/login";
        return;
      }
      setNotice({ tone: "ok", text: `Signed out ${session.deviceLabel}.` });
      onChanged();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => revokeOtherSessions(accessToken!, csrfToken!),
    onSuccess: (data) => {
      setConfirmAll(false);
      setNotice({ tone: "ok", text: data.signedOut ? `Signed out ${data.signedOut} other session${data.signedOut === 1 ? "" : "s"}.` : "No other sessions were signed in." });
      onChanged();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const others = sessions.filter((session) => !session.current).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active sessions</p>
        {others > 0 ? (
          confirmAll ? (
            <span className="flex items-center gap-2 text-[11px]">
              <button type="button" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending} className="inline-flex items-center gap-1 font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50">
                {revokeOthers.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Sign out {others}
              </button>
              <button type="button" onClick={() => setConfirmAll(false)} className="text-slate-500 hover:text-white">Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmAll(true)} className="text-[11px] font-semibold text-slate-400 hover:text-rose-300">Sign out all other sessions</button>
          )
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {sessions.map((session) => (
          <li key={session.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${session.current ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/5 bg-[#11151e]"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${session.current ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-400"}`}>
              <DeviceIcon label={session.deviceLabel} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-slate-100" title={session.deviceLabel}>{session.deviceLabel}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {session.current ? <span className="mr-1.5 font-bold uppercase tracking-[0.12em] text-emerald-300">This device ·</span> : null}
                Signed in {new Date(session.signedInAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · {session.current ? "active now" : ago(session.lastUsedAt)}
                {session.ipPrefix ? ` · ${session.ipPrefix}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => revokeOne.mutate(session)}
              disabled={revokeOne.isPending}
              className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-rose-300 disabled:opacity-40"
              title={session.current ? "Sign out of this device" : `Sign out ${session.deviceLabel}`}
              aria-label={session.current ? "Sign out of this device" : `Sign out ${session.deviceLabel}`}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {sessions.length === 0 ? <li className="text-xs text-slate-500">No active sessions.</li> : null}
      </ul>
      {notice ? <p className={`mt-2 text-[11px] ${notice.tone === "ok" ? "text-emerald-200" : "text-rose-300"}`} role="status">{notice.text}</p> : null}
    </div>
  );
}
