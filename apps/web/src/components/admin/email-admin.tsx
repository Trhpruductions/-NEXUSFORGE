"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCcw, Send } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api";
import {
  EMAIL_STATUS_VALUES,
  getEmailStats,
  getEmailStatus,
  getEmailTemplatePreview,
  listEmailMessages,
  listEmailTemplates,
  sendEmailTest,
  type EmailMessageStatus,
  type EmailMode,
} from "@/lib/admin-email-api";
import { useAuthStore } from "@/store/auth-store";

const MODE_COPY: Record<EmailMode, { label: string; tone: string; detail: string }> = {
  smtp: { label: "SMTP", tone: "text-emerald-200", detail: "Real sends. Accepted by the mail server is not the same as delivered to an inbox." },
  test: { label: "Test mode", tone: "text-amber-200", detail: "Nothing leaves the server. Every send is recorded and printed to the console." },
  unconfigured: { label: "Not configured", tone: "text-rose-200", detail: "No SMTP host and no test mode: every send fails." },
};

const STATUS_COPY: Record<EmailMessageStatus, { label: string; tone: string }> = {
  QUEUED: { label: "Queued", tone: "text-slate-300" },
  ACCEPTED: { label: "Accepted by SMTP", tone: "text-sky-200" },
  DELIVERED: { label: "Delivered (provider)", tone: "text-emerald-200" },
  BOUNCED: { label: "Bounced", tone: "text-rose-200" },
  COMPLAINED: { label: "Complaint", tone: "text-rose-200" },
  FAILED: { label: "Failed", tone: "text-rose-200" },
  UNKNOWN: { label: "Unknown", tone: "text-amber-200" },
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nexus-display-panel rounded-[24px] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-200">{children}</div>
    </section>
  );
}

function StatusCards() {
  const { accessToken } = useAuthStore();
  const query = useQuery({ queryKey: ["admin-email-status", accessToken], queryFn: () => getEmailStatus(accessToken!), enabled: Boolean(accessToken) });

  if (query.isLoading) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading status…</p>;
  if (query.isError || !query.data) return <p className="text-sm text-rose-300">{getApiErrorMessage(query.error)}</p>;
  const status = query.data;
  const mode = MODE_COPY[status.mode];

  return (
    <div className="space-y-4">
      {status.warnings.length ? (
        <ul className="space-y-1 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {status.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Transport">
          <p className={`text-lg font-semibold ${mode.tone}`}>{mode.label}</p>
          <p className="text-xs text-slate-400">{mode.detail}</p>
          <p className="text-xs text-slate-400">SMTP host {status.smtp.hostConfigured ? "set" : "not set"} · password {status.smtp.passwordConfigured ? "set" : "not set"}</p>
        </Card>
        <Card title="Sender">
          <p className="break-all font-mono text-xs">{status.sender.address}</p>
          <p className="text-xs text-slate-400">Display name: {status.sender.name}</p>
          <p className="text-xs text-slate-400">Reply-to {status.replyToConfigured ? "set" : "not set"}</p>
        </Card>
        <Card title="Provider webhook">
          <p className={status.webhook.enabled ? "text-emerald-200" : "text-slate-300"}>{status.webhook.enabled ? "Enabled" : "Disabled"}</p>
          <p className="break-all font-mono text-xs text-slate-400">{status.webhook.path}</p>
        </Card>
        <Card title="Contacts in footers">
          <p className="text-xs text-slate-400">Support: {status.contacts.support ?? "not set (not shown)"}</p>
          <p className="text-xs text-slate-400">Security: {status.contacts.security ?? "not set (not shown)"}</p>
          <p className="text-xs text-slate-400">Updates: {status.contacts.updates ?? "not set (not shown)"}</p>
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        Dedupe window {status.dedupeWindowSeconds}s · up to {status.maxRetries} retries on transient errors · unsubscribe key: {status.unsubscribe.keySource === "dedicated" ? "dedicated" : "derived from JWT secret"} · test allowlist: {status.testAllowlistCount} address(es)
      </p>
    </div>
  );
}

function StatsPanel() {
  const { accessToken } = useAuthStore();
  const query = useQuery({ queryKey: ["admin-email-stats", accessToken], queryFn: () => getEmailStats(accessToken!), enabled: Boolean(accessToken), refetchInterval: 60_000 });
  if (query.isLoading) return <p className="text-sm text-slate-400">Loading counts…</p>;
  if (query.isError || !query.data) return <p className="text-sm text-rose-300">{getApiErrorMessage(query.error)}</p>;
  const stats = query.data;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        {stats.total} email{stats.total === 1 ? "" : "s"} recorded in the last {stats.windowDays} days.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {EMAIL_STATUS_VALUES.map((value) => (
          <div key={value} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{STATUS_COPY[value].label}</p>
            <p className={`text-xl font-semibold ${STATUS_COPY[value].tone}`}>{stats.byStatus[value] ?? 0}</p>
          </div>
        ))}
      </div>
      {stats.byKind.length ? (
        <p className="text-xs text-slate-400">Most sent: {stats.byKind.map((row) => `${row.kind} (${row.count})`).join(", ")}</p>
      ) : null}
    </div>
  );
}

function MessagesTable() {
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState<EmailMessageStatus | "">("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["admin-email-messages", accessToken, status, cursor],
    queryFn: () => listEmailMessages(accessToken!, { status, cursor, limit: 50 }),
    enabled: Boolean(accessToken),
  });

  const older = () => {
    if (!query.data?.nextCursor) return;
    setTrail((previous) => [...previous, cursor ?? ""]);
    setCursor(query.data.nextCursor);
  };
  const newer = () => {
    const previous = trail[trail.length - 1];
    setTrail((items) => items.slice(0, -1));
    setCursor(previous ? previous : null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400" htmlFor="email-status-filter">Status</label>
        <select
          id="email-status-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as EmailMessageStatus | "");
            setCursor(null);
            setTrail([]);
          }}
          className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        >
          <option value="">All</option>
          {EMAIL_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {STATUS_COPY[value].label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void query.refetch()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/25">
          <RefreshCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-slate-400">Loading messages…</p>
      ) : query.isError ? (
        <p className="text-sm text-rose-300">{getApiErrorMessage(query.error)}</p>
      ) : !query.data?.messages.length ? (
        <p className="text-sm text-slate-400">No messages recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">When (UTC)</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Transport</th>
                <th className="px-3 py-2">Tries</th>
                <th className="px-3 py-2">Error (redacted)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {query.data.messages.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono">{row.kind}</span>
                    <span className="block text-[11px] text-slate-500">{row.category === "OPTIONAL" ? "optional" : "essential"}</span>
                  </td>
                  <td className={`px-3 py-2 ${STATUS_COPY[row.status].tone}`}>{STATUS_COPY[row.status].label}</td>
                  <td className="px-3 py-2 font-mono">{row.recipientMasked}</td>
                  <td className="px-3 py-2">{row.transport}</td>
                  <td className="px-3 py-2">{row.attempts}</td>
                  <td className="max-w-[24rem] break-words px-3 py-2 text-slate-400">{row.lastError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" disabled={!trail.length} onClick={newer} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40">
          Newer
        </button>
        <button type="button" disabled={!query.data?.nextCursor} onClick={older} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40">
          Older
        </button>
      </div>
    </div>
  );
}

function TemplatePreview() {
  const { accessToken } = useAuthStore();
  const [kind, setKind] = useState<string | null>(null);
  const templatesQuery = useQuery({
    queryKey: ["admin-email-templates", accessToken],
    queryFn: () => listEmailTemplates(accessToken!),
    enabled: Boolean(accessToken),
  });
  const selected = kind ?? templatesQuery.data?.[0]?.kind ?? null;
  const previewQuery = useQuery({
    queryKey: ["admin-email-preview", accessToken, selected],
    queryFn: () => getEmailTemplatePreview(accessToken!, selected!),
    enabled: Boolean(accessToken && selected),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400" htmlFor="email-template-select">Template</label>
        <select
          id="email-template-select"
          value={selected ?? ""}
          onChange={(event) => setKind(event.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        >
          {(templatesQuery.data ?? []).map((template) => (
            <option key={template.kind} value={template.kind}>
              {template.label} · {template.category === "OPTIONAL" ? "optional" : "essential"}
            </option>
          ))}
        </select>
      </div>
      {previewQuery.data ? (
        <>
          <p className="text-sm text-slate-200">
            <span className="text-slate-400">Subject:</span> {previewQuery.data.subject}
          </p>
          <iframe
            sandbox=""
            srcDoc={previewQuery.data.html}
            title="Template preview"
            className="h-[560px] w-full rounded-2xl border border-white/10 bg-[#070a12]"
          />
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">Plain-text version</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-slate-200">{previewQuery.data.text}</pre>
          </details>
          <p className="text-[11px] text-slate-500">Preview uses placeholder data only. No real account, code or link is shown.</p>
        </>
      ) : previewQuery.isError ? (
        <p className="text-sm text-rose-300">{getApiErrorMessage(previewQuery.error)}</p>
      ) : (
        <p className="text-sm text-slate-400">Loading preview…</p>
      )}
    </div>
  );
}

function TestSend() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [to, setTo] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => sendEmailTest(accessToken!, csrfToken!, { to: to.trim(), password }),
    onSuccess: async (data) => {
      setPassword("");
      if (data.suppressed) setResult("A test email to this address went out in the last minute, so this one was held back.");
      else if (data.accepted) setResult(`Accepted by the ${data.transport === "test" ? "test transport (nothing left the server)" : "mail server"}. That is not proof it reached an inbox.`);
      else setResult(`Not sent: ${data.error ?? "unknown error"}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-email-messages"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-email-stats"] });
    },
    onError: (error) => {
      setPassword("");
      setResult(getApiErrorMessage(error));
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        send.mutate();
      }}
    >
      <label className="space-y-1 text-xs text-slate-400">
        Send to
        <input
          type="email"
          required
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="your own verified address"
          autoComplete="off"
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        Your password (to confirm)
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      <button type="submit" disabled={send.isPending || !password || !to} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
        {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
      </button>
      <p className="text-xs text-slate-500 md:col-span-3">
        Test emails go only to your own verified address or to an address on the server&apos;s test allowlist. You confirm with your password each time, and it is not kept.
      </p>
      {result ? <p className="text-sm text-slate-200 md:col-span-3">{result}</p> : null}
    </form>
  );
}

/** Staff: delivery status, recent sends (redacted), template previews and a test send. The server checks the role on every request. */
export function EmailAdmin() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Status</h2>
        <StatusCards />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Last 7 days</h2>
        <StatsPanel />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Recent messages</h2>
        <MessagesTable />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Templates</h2>
        <TemplatePreview />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Send a test email</h2>
        <TestSend />
      </section>
    </div>
  );
}
