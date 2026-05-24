"use client";

import { useEffect, useState } from "react";

const initialCountdown = [
  { label: "Days", value: "03" },
  { label: "Hours", value: "12" },
  { label: "Minutes", value: "45" },
  { label: "Seconds", value: "20" },
];

const pad = (value: number) => String(value).padStart(2, "0");

const getCountdown = (targetDate: Date) => {
  const now = new Date();
  const delta = Math.max(targetDate.getTime() - now.getTime(), 0);
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / 60000) % 60;
  const hours = Math.floor(delta / 3600000) % 24;
  const days = Math.floor(delta / 86400000);

  return [
    { label: "Days", value: pad(days) },
    { label: "Hours", value: pad(hours) },
    { label: "Minutes", value: pad(minutes) },
    { label: "Seconds", value: pad(seconds) },
  ];
};

export function LaunchCountdown() {
  const [countdown, setCountdown] = useState(initialCountdown);

  useEffect(() => {
    const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000 + 45 * 60 * 1000 + 20 * 1000);

    const tick = () => setCountdown(getCountdown(targetDate));
    tick();

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="launch-countdown-grid mt-6 grid grid-cols-4 gap-3 text-center" role="status" aria-live="polite">
      {countdown.map((item) => (
        <div key={item.label} className="countdown-card rounded-3xl border border-slate-700/60 bg-slate-950/85 p-4 shadow-[0_12px_24px_rgba(2,6,23,0.25)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
          <p className="countdown-value mt-2 text-3xl font-semibold text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
