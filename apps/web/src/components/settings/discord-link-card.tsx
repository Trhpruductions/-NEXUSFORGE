"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Unlink } from "lucide-react";
import { api, authHeaders, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type LinkStatus = { linked: boolean; linkedAt: string | null };

/**
 * Settings > Connections > Discord. Linking is proven both ways: you get a one-time code
 * here and type /link CODE to the Vexora bot in Discord. The bot only trusts this link.
 */
export function DiscordLinkCard() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const key = ["discord-link", accessToken];
  const status = useQuery({ queryKey: key, queryFn: async () => (await api.get<LinkStatus>("/api/me/discord", { headers: authHeaders(accessToken) })).data, enabled: Boolean(accessToken) });
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // While a code is showing, check every few seconds whether it has been used.
  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void queryClient.invalidateQueries({ queryKey: key });
    }, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  useEffect(() => {
    if (status.data?.linked) setCode(null);
  }, [status.data?.linked]);

  const getCode = useMutation({
    mutationFn: async () => (await api.post<{ code: string; expiresAt: string }>("/api/me/discord/link-code", {}, { headers: authHeaders(accessToken, csrfToken) })).data,
    onSuccess: (data) => {
      setCode(data);
      setCopied(false);
      setNow(Date.now());
    },
  });
  const unlink = useMutation({
    mutationFn: async () => (await api.delete<LinkStatus>("/api/me/discord", { headers: authHeaders(accessToken, csrfToken) })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const minutesLeft = code ? Math.max(0, Math.ceil((new Date(code.expiresAt).getTime() - now) / 60000)) : 0;
  const error = getCode.error ?? unlink.error;

  return (
    <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/[0.06] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">Discord bot</p>
      {status.data?.linked ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
          <Check className="h-4 w-4 text-emerald-300" />
          <span>Linked{status.data.linkedAt ? ` on ${new Date(status.data.linkedAt).toLocaleDateString()}` : ""}. The bot&apos;s /balance and /mining show your account.</span>
          <button type="button" onClick={() => { if (window.confirm("Unlink your Discord account? The bot will stop recognising you.")) unlink.mutate(); }} disabled={unlink.isPending} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-200">
            <Unlink className="h-3.5 w-3.5" /> Unlink
          </button>
        </div>
      ) : code && minutesLeft > 0 ? (
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          <p>In the Vexora Discord server, type:</p>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-base tracking-[0.2em] text-white">/link {code.code}</code>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(`/link ${code.code}`).then(() => setCopied(true)).catch(() => undefined); }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:text-white"
              aria-label="Copy the link command"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Waiting for the bot… the code works for {minutesLeft} more minute{minutesLeft === 1 ? "" : "s"} and only once.</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <span>Use the Vexora bot&apos;s /balance and /mining with your account.</span>
          <button type="button" onClick={() => getCode.mutate()} disabled={getCode.isPending || !accessToken} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50">
            {getCode.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Link Discord
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-rose-300">{getApiErrorMessage(error)}</p> : null}
    </div>
  );
}
