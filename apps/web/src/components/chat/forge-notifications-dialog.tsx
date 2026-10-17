"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { getApiErrorMessage, getForgeNotificationSettings, updateForgeNotificationSettings, type ForgeNotificationSettings } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const muteChoices: Array<{ minutes: 15 | 60 | 180 | 480 | 1440 | -1; label: string }> = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: -1, label: "Until I turn it back on" },
];

const levels: Array<{ value: ForgeNotificationSettings["notifyLevel"]; label: string; hint: string }> = [
  { value: "MENTIONS", label: "@mentions", hint: "Pings when someone mentions you, your role, @everyone or @here." },
  { value: "NONE", label: "Nothing", hint: "No pings or mention badges from this forge." },
];

/** Your own notification settings for one forge: mute, level, and @everyone suppression. */
export function ForgeNotificationsDialog({ forgeId, forgeName, open, onClose }: { forgeId: string; forgeName: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const queryKey = ["forge-notifications", forgeId, accessToken];
  const settingsQuery = useQuery({ queryKey, queryFn: () => getForgeNotificationSettings(accessToken!, forgeId), enabled: Boolean(open && accessToken && forgeId) });
  const settings = settingsQuery.data;

  const update = useMutation({
    mutationFn: (payload: Parameters<typeof updateForgeNotificationSettings>[3]) => updateForgeNotificationSettings(accessToken!, csrfToken!, forgeId, payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKey, data);
      await queryClient.invalidateQueries({ queryKey: ["unread-summary"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const mutedLabel = settings?.muted ? (settings.mutedForever ? "Muted until you turn it back on" : `Muted until ${new Date(settings.mutedUntil!).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`) : null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="forge-notify-title" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/70 via-amber-400/80 to-cyan-400/70" />
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div className="min-w-0">
            <h2 id="forge-notify-title" className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-amber-300" /> Notification settings</h2>
            <p className="truncate text-[11px] text-slate-400">{forgeName} · only affects you</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-lg p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        {!settings ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Mute forge</p>
              {settings.muted ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-violet-100"><BellOff className="h-4 w-4" /> {mutedLabel}</span>
                  <button type="button" disabled={update.isPending} onClick={() => update.mutate({ muteMinutes: 0 })} className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-violet-400/50">Unmute</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {muteChoices.map((choice) => (
                    <button key={choice.minutes} type="button" disabled={update.isPending} onClick={() => update.mutate({ muteMinutes: choice.minutes })} className={`rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-200 transition hover:border-violet-400/50 hover:text-white ${choice.minutes === -1 ? "col-span-2 sm:col-span-3" : ""}`}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500">While muted you get no notifications from this forge and no unread dot; mention badges still show.</p>
            </section>

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">Notify me about</legend>
              <div className="space-y-1.5">
                {levels.map((level) => (
                  <label key={level.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${(settings.notifyLevel === "ALL" ? "MENTIONS" : settings.notifyLevel) === level.value ? "border-sky-400/50 bg-sky-500/10" : "border-white/5 hover:border-white/15"}`}>
                    <input type="radio" name="notify-level" className="mt-0.5" checked={(settings.notifyLevel === "ALL" ? "MENTIONS" : settings.notifyLevel) === level.value} disabled={update.isPending} onChange={() => update.mutate({ notifyLevel: level.value })} />
                    <span>
                      <span className="block font-semibold text-slate-100">{level.label}</span>
                      <span className="block text-[11px] text-slate-400">{level.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/5 px-3 py-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={settings.suppressEveryone} disabled={update.isPending} onChange={(event) => update.mutate({ suppressEveryone: event.target.checked })} />
              <span>
                <span className="block font-semibold text-slate-100">Suppress @everyone and @here</span>
                <span className="block text-[11px] text-slate-400">You&apos;ll still be pinged when someone mentions you or your role directly.</span>
              </span>
            </label>
            {update.isError ? <p role="alert" className="text-xs text-rose-300">{getApiErrorMessage(update.error)}</p> : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
