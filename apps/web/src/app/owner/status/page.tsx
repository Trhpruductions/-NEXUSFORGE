"use client";

import { OwnerCard, OwnerEmpty, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatBytes, formatCount, formatDateTime, formatDuration } from "@/components/owner/format";
import type { ServiceStatus } from "@/lib/owner-api";
import { cn } from "@/lib/utils";

const REFRESH_SECONDS = 15;

type ServicesResponse = {
  checkedAt: string;
  counts: Record<ServiceStatus, number>;
  services: Array<{ id: string; name: string; status: ServiceStatus; latencyMs: number | null; detail: string; checkedAt: string }>;
  host: {
    hostUptimeSeconds: number;
    processUptimeSeconds: number;
    cpuCount: number;
    loadAverage: number[];
    memory: { totalBytes: number; freeBytes: number; usedPercent: number };
    disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null;
    processMemoryBytes: number;
  };
};

const STATUS_TONE: Record<ServiceStatus, string> = {
  Online: "text-emerald-200",
  Degraded: "text-amber-200",
  Offline: "text-rose-200",
  Unknown: "text-slate-300",
  "Not Configured": "text-slate-500",
};

export default function OwnerLiveStatusPage() {
  const query = useOwnerQuery<ServicesResponse>("/services", { refetchMs: REFRESH_SECONDS * 1000 });
  const data = query.data;

  return (
    <OwnerFrame title="Live status" subtitle="Each service is probed, not assumed. Unknown means no probe exists from this server yet. Not Configured means required settings are missing.">
      <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />

      {data ? (
        <div className="grid gap-3 md:grid-cols-5">
          {(Object.keys(data.counts) as ServiceStatus[]).map((status) => (
            <div key={status} className="nexus-display-panel rounded-2xl p-4">
              <p className={cn("text-[11px] uppercase tracking-[0.14em]", STATUS_TONE[status])}>{status}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{formatCount(data.counts[status])}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-2 py-2">Service</th>
              <th className="px-2">Status</th>
              <th className="px-2 text-right">Response</th>
              <th className="px-2">Detail</th>
              <th className="px-2">Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {!data ? (
              <tr><td colSpan={5}><OwnerEmpty>{query.isError ? "Could not load service checks." : "Checking services…"}</OwnerEmpty></td></tr>
            ) : null}
            {data?.services.map((service) => (
              <tr key={service.id} className="align-top text-slate-300">
                <td className="px-2 py-2 text-slate-100">{service.name}</td>
                <td className={cn("px-2 font-medium", STATUS_TONE[service.status])}>{service.status}</td>
                <td className="px-2 text-right tabular-nums">{service.latencyMs !== null ? `${service.latencyMs} ms` : "—"}</td>
                <td className="px-2 text-xs text-slate-400">{service.detail}</td>
                <td className="px-2 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(service.checkedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <OwnerCard title="Host">
            <OwnerStat label="Host uptime" value={formatDuration(data.host.hostUptimeSeconds)} />
            <OwnerStat label="API process uptime" value={formatDuration(data.host.processUptimeSeconds)} />
            <OwnerStat label="CPU cores" value={formatCount(data.host.cpuCount)} />
            <OwnerStat label="Load average (1m)" value={String(data.host.loadAverage[0] ?? "—")} hint="Operating system load, not CPU percentage" />
          </OwnerCard>
          <OwnerCard title="Memory and disk">
            <OwnerStat label="Host memory used" value={`${data.host.memory.usedPercent}%`} hint={`${formatBytes(data.host.memory.totalBytes - data.host.memory.freeBytes)} of ${formatBytes(data.host.memory.totalBytes)}`} />
            <OwnerStat label="API process memory" value={formatBytes(data.host.processMemoryBytes)} />
            <OwnerStat label="Disk used" value={data.host.disk ? `${data.host.disk.usedPercent}%` : "Not available"} hint={data.host.disk ? `${formatBytes(data.host.disk.freeBytes)} free` : "The host did not expose disk usage"} />
          </OwnerCard>
          <OwnerCard title="Not monitored yet">
            <p className="text-sm text-slate-400">Chat and voice sockets, background jobs, and the VEXORA gateway have no probe from this server. They show Unknown until one is added. Their process running is not treated as healthy.</p>
          </OwnerCard>
        </div>
      ) : null}
    </OwnerFrame>
  );
}
