"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";

/** Live service status: the API's own health check, re-run every minute, plus the desktop app version. */
export function StatusCard() {
  const health = useQuery({
    queryKey: ["public-health"],
    queryFn: async () => {
      const started = Date.now();
      const { data } = await api.get<{ status: string }>("/api/health", { timeout: 8000 });
      return { ok: data.status === "ok", ms: Date.now() - started, at: new Date() };
    },
    refetchInterval: 60_000,
    retry: 1,
  });
  const desktop = useQuery({
    queryKey: ["desktop-manifest-version"],
    queryFn: async () => (await fetch("/desktop-update.json", { cache: "no-store" }).then((r) => r.json())) as { version?: string },
    staleTime: 10 * 60_000,
    retry: 0,
  });

  const up = health.data?.ok === true;
  const checking = health.isLoading;
  const tone = checking ? "border-white/10" : up ? "border-emerald-400/30" : "border-amber-400/40";

  return (
    <section id="status" aria-live="polite" className={`scroll-mt-24 rounded-2xl border bg-[#0d1119] p-5 ${tone}`}>
      <h2 className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white"><Activity className="h-4 w-4 text-amber-300" /> Service status</h2>
      <div className="mt-3 flex items-start gap-3">
        {checking ? <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-slate-400" /> : up ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /> : <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />}
        <div className="text-sm">
          <p className="font-semibold text-white">{checking ? "Checking…" : up ? "All systems normal" : "Having trouble reaching the server"}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {checking
              ? "Asking the server how it's doing."
              : up
                ? `Website and API responding (${health.data?.ms} ms). Checked ${health.data?.at.toLocaleTimeString()}.`
                : "The website loaded but the API didn't answer. Chat, sign-in and voice may not work right now. Try again in a few minutes."}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-white/5 bg-[#11151e] px-2 py-2">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Website</dt>
          <dd className="mt-0.5 font-semibold text-emerald-200">Up</dd>
        </div>
        <div className="rounded-lg border border-white/5 bg-[#11151e] px-2 py-2">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">API &amp; chat</dt>
          <dd className={`mt-0.5 font-semibold ${checking ? "text-slate-300" : up ? "text-emerald-200" : "text-amber-200"}`}>{checking ? "…" : up ? "Up" : "Down"}</dd>
        </div>
        <div className="rounded-lg border border-white/5 bg-[#11151e] px-2 py-2">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Desktop app</dt>
          <dd className="mt-0.5 font-semibold text-slate-200">{desktop.data?.version ? `v${desktop.data.version}` : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
