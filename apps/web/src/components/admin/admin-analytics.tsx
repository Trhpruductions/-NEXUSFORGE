"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Table2 } from "lucide-react";
import { getAdminAnalytics, type AdminAnalytics } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

// Validated with the dataviz palette checker against the dashboard surface (#0d1119):
// lightness band, chroma, CVD and normal-vision separation and contrast all pass.
const GOLD = "#b98a14";
const BLUE = "#1d9bd8";

type Series = { label: string; color: string; values: number[] };

function fmt(value: number) {
  return Math.abs(value) >= 10_000 ? `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}k` : value.toLocaleString();
}

function dayLabel(iso: string, withYear = false) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC", ...(withYear ? { year: "numeric" } : {}) });
}

/** Line chart for daily series: one y-axis, recessive grid, hover crosshair + tooltip. */
/** `width` is the drawing width in SVG units; match it roughly to the rendered width so text stays ~9-10px. */
function LineChart({ days, series, height = 120, showLegend = false, width = 600 }: { days: string[]; series: Series[]; height?: number; showLegend?: boolean; width?: number }) {
  const pad = { top: 10, right: showLegend ? 62 : 10, bottom: 18, left: 34 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / pow) * pow;
  })();
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (days.length <= 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / niceMax) * plotH;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / plotW) * (days.length - 1));
    setHover(Math.min(days.length - 1, Math.max(0, i)));
  };

  const tooltipLeft = hover === null ? 0 : (x(hover) / width) * 100;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full touch-none"
        role="img"
        aria-label={`${series.map((s) => s.label).join(" and ")}, daily, ${dayLabel(days[0])} to ${dayLabel(days[days.length - 1])}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Recessive grid: baseline, midline, top. */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(niceMax * t)} y2={y(niceMax * t)} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(niceMax * t) + 3} textAnchor="end" fontSize={9} fill="#64748b">{fmt(niceMax * t)}</text>
          </g>
        ))}
        <text x={pad.left} y={height - 4} fontSize={9} fill="#64748b">{dayLabel(days[0])}</text>
        <text x={width - pad.right} y={height - 4} fontSize={9} fill="#64748b" textAnchor="end">{dayLabel(days[days.length - 1])}</text>

        {series.map((s) => {
          const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          return (
            <g key={s.label}>
              {series.length === 1 ? (
                <polygon points={`${x(0)},${y(0)} ${points} ${x(s.values.length - 1)},${y(0)}`} fill={s.color} opacity={0.12} />
              ) : null}
              <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {showLegend ? (
                // Direct label at the line's end, so identity never rests on color alone.
                <text x={x(s.values.length - 1) + 6} y={y(s.values[s.values.length - 1]) + 3} fontSize={10} fill="#cbd5e1">{s.label}</text>
              ) : null}
            </g>
          );
        })}

        {hover !== null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke="rgba(203,213,225,0.35)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="#0d1119" strokeWidth={2} />
            ))}
          </g>
        ) : null}
      </svg>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-white/10 bg-[#070a10]/95 px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, tooltipLeft))}%` }}
          role="status"
        >
          <p className="text-slate-400">{dayLabel(days[hover], true)}</p>
          {series.map((s) => (
            <p key={s.label} className="flex items-center gap-1.5 text-slate-100">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <span className="font-semibold">{s.values[hover].toLocaleString()}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="nf-heading mt-1 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

const metricCharts: Array<{ key: keyof AdminAnalytics["series"]; label: string }> = [
  { key: "activeUsers", label: "Active players" },
  { key: "signups", label: "Sign-ups" },
  { key: "messages", label: "Messages" },
  { key: "posts", label: "Posts" },
];

export function AdminAnalyticsPanel() {
  const { accessToken } = useAuthStore();
  const queryScope = useQueryScope();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [asTable, setAsTable] = useState(false);
  const query = useQuery({
    queryKey: ["admin-analytics", days, queryScope],
    queryFn: () => getAdminAnalytics(accessToken!, days),
    enabled: Boolean(accessToken),
    refetchInterval: 5 * 60_000,
  });
  const data = query.data;

  const netCoins = useMemo(() => (data ? data.totals.coinsMinted - data.totals.coinsBurned : 0), [data]);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#070a10]/60 p-4">
      {/* Filters in one row above the charts. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.24em] text-amber-300">Growth &amp; activity</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/10 p-0.5" role="tablist" aria-label="Date range">
            {([7, 30, 90] as const).map((range) => (
              <button key={range} type="button" role="tab" aria-selected={days === range} onClick={() => setDays(range)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${days === range ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                {range}d
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${asTable ? "border-amber-400/60 text-amber-200" : "border-white/10 text-slate-400 hover:text-white"}`}>
            <Table2 className="h-3 w-3" /> {asTable ? "Show charts" : "Show as table"}
          </button>
        </div>
      </div>

      {query.isLoading || !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Active today" value={fmt(data.totals.activeUsersToday)} hint={`Peak ${fmt(data.totals.activeUsersPeak)} in ${days} days`} />
            <StatTile label={`Sign-ups (${days}d)`} value={fmt(data.totals.signups)} />
            <StatTile label={`Messages (${days}d)`} value={fmt(data.totals.messages)} hint={`${fmt(data.totals.posts)} posts`} />
            <StatTile label={`Coin supply (${days}d)`} value={`${netCoins >= 0 ? "+" : ""}${fmt(netCoins)}`} hint={`${fmt(data.totals.coinsMinted)} created · ${fmt(data.totals.coinsBurned)} destroyed`} />
          </div>

          {asTable ? (
            <div className="max-h-96 overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0d1119] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    {["Day", "Active", "Sign-ups", "Messages", "Posts", "Forges", "Coins created", "Coins destroyed"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {[...data.days].reverse().map((day, ri) => {
                    const i = data.days.length - 1 - ri;
                    return (
                      <tr key={day}>
                        <td className="px-3 py-1.5 text-slate-400">{dayLabel(day, true)}</td>
                        {[data.series.activeUsers, data.series.signups, data.series.messages, data.series.posts, data.series.forges, data.series.coinsMinted, data.series.coinsBurned].map((values, k) => (
                          <td key={k} className="px-3 py-1.5 tabular-nums">{values[i].toLocaleString()}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {metricCharts.map((metric) => (
                  <div key={metric.key} className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
                    <p className="mb-1 text-[11px] font-semibold text-slate-300">{metric.label} <span className="font-normal text-slate-500">per day</span></p>
                    <LineChart days={data.days} series={[{ label: metric.label, color: GOLD, values: data.series[metric.key] }]} />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-300">Coin economy <span className="font-normal text-slate-500">per day · transfers between players excluded</span></p>
                  <p className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: GOLD }} /> Created</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: BLUE }} /> Destroyed</span>
                  </p>
                </div>
                <LineChart
                  days={data.days}
                  height={200}
                  width={1240}
                  showLegend
                  series={[
                    { label: "Created", color: GOLD, values: data.series.coinsMinted },
                    { label: "Destroyed", color: BLUE, values: data.series.coinsBurned },
                  ]}
                />
              </div>
            </>
          )}

          <div className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
            <p className="mb-2 text-[11px] font-semibold text-slate-300">Most active forges <span className="font-normal text-slate-500">by messages, last {days} days</span></p>
            {data.topForges.length ? (
              <ol className="space-y-1.5">
                {data.topForges.map((forge, index) => (
                  <li key={forge.id} className="flex items-center gap-3 text-xs">
                    <span className="w-4 text-right text-slate-500">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-100">{forge.name}</span>
                    <span className="tabular-nums text-slate-300">{forge.messages.toLocaleString()} msgs</span>
                    <span className="w-20 text-right tabular-nums text-slate-500">{forge.members.toLocaleString()} members</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-slate-500">No forge messages in this period.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
