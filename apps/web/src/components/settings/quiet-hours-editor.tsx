"use client";

import { useEffect } from "react";
import { Moon } from "lucide-react";
import type { NotificationPreferences } from "@/lib/api";
import { Toggle } from "./toggle";

type QuietHours = NotificationPreferences["quietHours"];

const DEFAULT: QuietHours = { enabled: false, start: "22:00", end: "08:00", timeZone: "UTC" };

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function QuietHoursEditor({ value, onChange }: { value: QuietHours | undefined; onChange: (next: QuietHours) => void }) {
  const quiet = value ?? DEFAULT;
  const zone = browserTimeZone();

  // Hours are meant in the user's own clock, so turning quiet hours on adopts this
  // browser's time zone.
  useEffect(() => {
    if (quiet.enabled && quiet.timeZone === "UTC" && zone !== "UTC") onChange({ ...quiet, timeZone: zone });
  }, [quiet, zone, onChange]);

  const timeClass = "rounded-lg border border-white/10 bg-[#0a0d14] px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-400/60 disabled:opacity-40 [color-scheme:dark]";

  return (
    <div className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-100"><Moon className="h-3.5 w-3.5 text-amber-300" /> Quiet hours</span>
          <span className="block text-[11px] text-slate-500">Notifications still arrive in your inbox, but no push alerts or sounds. Security alerts always come through.</span>
        </span>
        <Toggle checked={quiet.enabled} label="Quiet hours" onChange={(enabled) => onChange({ ...quiet, enabled, timeZone: enabled ? zone : quiet.timeZone })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>From</span>
        <input type="time" value={quiet.start} disabled={!quiet.enabled} onChange={(event) => event.target.value && onChange({ ...quiet, start: event.target.value })} className={timeClass} aria-label="Quiet hours start" />
        <span>to</span>
        <input type="time" value={quiet.end} disabled={!quiet.enabled} onChange={(event) => event.target.value && onChange({ ...quiet, end: event.target.value })} className={timeClass} aria-label="Quiet hours end" />
        <span className="text-[11px] text-slate-500">{quiet.enabled ? `(${quiet.timeZone.replace(/_/g, " ")})` : ""}</span>
      </div>
      {quiet.enabled && quiet.start === quiet.end ? <p className="mt-2 text-[11px] text-amber-200">Start and end are the same, so quiet hours won&apos;t apply.</p> : null}
    </div>
  );
}
