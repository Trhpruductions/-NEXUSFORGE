"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Archive, Check, Eye, FilePlus2, History, Loader2, Pencil, RotateCcw, Send, ShieldCheck, Undo2, X } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api";
import { adminCreateDraft, adminEditVersion, adminGetVersion, adminLegalAudit, adminListPolicies, adminTransition, type AdminPolicy, type AdminVersionRow } from "@/lib/legal-api";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { useAuthStore } from "@/store/auth-store";

const statusStyle: Record<string, string> = {
  DRAFT: "border-slate-500/50 text-slate-200",
  IN_REVIEW: "border-sky-400/50 bg-sky-500/10 text-sky-200",
  PUBLISHED: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
  ARCHIVED: "border-white/10 text-slate-500",
};
const statusLabel: Record<string, string> = { DRAFT: "Draft", IN_REVIEW: "In review", PUBLISHED: "Published", ARCHIVED: "Archived" };

const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const primary = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const danger = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40";
const input = "w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60";

function when(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/** Legal Administrator dashboard. Every action is also permission-checked by the server. */
export function LegalAdmin() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [slug, setSlug] = useState<string>("terms");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tab, setTab] = useState<"versions" | "audit">("versions");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const listQuery = useQuery({ queryKey: ["legal-admin", accessToken], queryFn: () => adminListPolicies(accessToken!), enabled: Boolean(accessToken) });
  const policies = listQuery.data?.policies ?? [];
  const canPublish = listQuery.data?.canPublish ?? false;
  const policy = policies.find((entry) => entry.slug === slug) ?? null;

  // Open the newest version of the selected policy by default.
  useEffect(() => {
    if (policy && !policy.versions.some((version) => version.id === versionId)) setVersionId(policy.versions[0]?.id ?? null);
  }, [policy, versionId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["legal-admin"] });
    await queryClient.invalidateQueries({ queryKey: ["legal-version"] });
    await queryClient.invalidateQueries({ queryKey: ["legal-audit"] });
    await queryClient.invalidateQueries({ queryKey: ["legal-policies"] });
  };

  const createDraft = useMutation({
    mutationFn: () => adminCreateDraft(accessToken!, csrfToken!, slug),
    onSuccess: async (data) => {
      await refresh();
      setVersionId(data.version.id);
      setNotice({ tone: "ok", text: `Version ${data.version.version} created as a draft.` });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  if (listQuery.isError) {
    return <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-100">{getApiErrorMessage(listQuery.error)}</p>;
  }

  const openDraft = policy?.versions.find((version) => version.status === "DRAFT" || version.status === "IN_REVIEW");

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-1.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Documents</p>
        {listQuery.isLoading ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {policies.map((entry) => (
          <PolicyButton key={entry.slug} policy={entry} active={entry.slug === slug} onClick={() => { setSlug(entry.slug); setVersionId(null); setNotice(null); }} />
        ))}
        <p className="pt-3 text-[11px] leading-relaxed text-slate-500">
          Admins draft and submit. Owners and executives publish. Publishing makes a version the one in effect; it is not a legal approval.
        </p>
      </aside>

      <section className="min-w-0 space-y-4">
        {policy ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{policy.title}</h2>
              <p className="text-xs text-slate-500">
                /legal/{policy.slug}
                {policy.requiredAtSignup ? " · must be accepted at sign-up" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={tab === "versions" ? primary : btn} onClick={() => setTab("versions")}>Versions</button>
              <button type="button" className={tab === "audit" ? primary : btn} onClick={() => setTab("audit")}><History className="h-3.5 w-3.5" /> Audit log</button>
              <Link href={`/legal/${policy.slug}`} target="_blank" className={btn}><Eye className="h-3.5 w-3.5" /> Public page</Link>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p role="status" className={notice.tone === "ok" ? "rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100" : "rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-100"}>
            {notice.text}
          </p>
        ) : null}

        {policy && tab === "versions" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {policy.versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => { setVersionId(version.id); setNotice(null); }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${statusStyle[version.status]} ${version.id === versionId ? "ring-2 ring-violet-400/60" : "hover:brightness-125"}`}
                >
                  v{version.version} · {statusLabel[version.status]}
                </button>
              ))}
              <button type="button" className={btn} disabled={Boolean(openDraft) || createDraft.isPending} title={openDraft ? `Version ${openDraft.version} is still open` : undefined} onClick={() => createDraft.mutate()}>
                <FilePlus2 className="h-3.5 w-3.5" /> New version
              </button>
            </div>
            {versionId ? (
              <VersionEditor key={versionId} versionId={versionId} policy={policy} canPublish={canPublish} setNotice={setNotice} onChanged={refresh} onOpen={setVersionId} />
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">No versions yet. Start one with “New version”.</p>
            )}
          </>
        ) : null}

        {policy && tab === "audit" ? <AuditLog slug={policy.slug} /> : null}
      </section>
    </div>
  );
}

function PolicyButton({ policy, active, onClick }: { policy: AdminPolicy; active: boolean; onClick: () => void }) {
  const published = policy.versions.find((version) => version.status === "PUBLISHED");
  const open = policy.versions.find((version) => version.status === "DRAFT" || version.status === "IN_REVIEW");
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${active ? "bg-violet-500/15 text-white shadow-[inset_2px_0_0_#a78bfa]" : "text-slate-300 hover:bg-white/[0.04]"}`}>
      <span className="min-w-0 truncate">{policy.title}</span>
      <span className="flex shrink-0 gap-1">
        {published ? <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] text-emerald-200">v{published.version}</span> : null}
        {open ? <span className={`rounded-full border px-1.5 text-[10px] ${statusStyle[open.status]}`}>{open.status === "IN_REVIEW" ? "review" : "draft"}</span> : null}
        {!published && !open ? <span className="text-[10px] text-slate-600">empty</span> : null}
      </span>
    </button>
  );
}

function VersionEditor({
  versionId,
  policy,
  canPublish,
  setNotice,
  onChanged,
  onOpen,
}: {
  versionId: string;
  policy: AdminPolicy;
  canPublish: boolean;
  setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void;
  onChanged: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const { accessToken, csrfToken } = useAuthStore();
  const versionQuery = useQuery({ queryKey: ["legal-version", versionId, accessToken], queryFn: () => adminGetVersion(accessToken!, versionId), enabled: Boolean(accessToken) });
  const data = versionQuery.data;
  const version = data?.version;
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [consentText, setConsentText] = useState("");
  const [requiresConsent, setRequiresConsent] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState<"publish" | "withdraw" | "discard" | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (!version) return;
    setContent(version.content);
    setSummary(version.changeSummary ?? "");
    setConsentText(version.consentText ?? "");
    setRequiresConsent(version.requiresConsent);
    setPreview(version.status !== "DRAFT");
  }, [version]);

  const isDraft = version?.status === "DRAFT";
  const dirty = Boolean(version && isDraft && (content !== version.content || summary !== (version.changeSummary ?? "") || consentText !== (version.consentText ?? "") || requiresConsent !== version.requiresConsent));
  const firstPublication = !policy.versions.some((entry: AdminVersionRow) => entry.publishedAt && entry.id !== versionId);
  const placeholders = useMemo(() => {
    const found = new Set<string>();
    for (const match of content.matchAll(/\[([A-Z][^\]\n]{1,80})\](?!\()/g)) found.add(match[0]);
    return [...found];
  }, [content]);

  const save = useMutation({
    mutationFn: () => adminEditVersion(accessToken!, csrfToken!, versionId, { content, changeSummary: summary || null, consentText: consentText || undefined, requiresConsent }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Draft saved." });
      await versionQuery.refetch();
      await onChanged();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const transition = useMutation({
    mutationFn: (payload: Parameters<typeof adminTransition>[3]) => adminTransition(accessToken!, csrfToken!, versionId, payload),
    onSuccess: async (result, payload) => {
      setConfirming(null);
      setUnderstood(false);
      const messages: Record<string, string> = {
        submit: "Sent for review. It can't be edited while in review.",
        return: "Back to draft.",
        publish: `Version ${result.version.version} is now published${result.replaced ? ` (version ${result.replaced} archived)` : ""}.`,
        archive: "Archived.",
        restore: `Restored into a new draft, version ${result.version.version}.`,
      };
      setNotice({ tone: "ok", text: messages[payload.action] });
      await onChanged();
      if (payload.action === "restore") onOpen(result.version.id);
      else await versionQuery.refetch();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  if (versionQuery.isLoading || !version) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading version...</p>;

  return (
    <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className={`mr-2 rounded-full border px-2 py-0.5 text-[11px] ${statusStyle[version.status]}`}>v{version.version} · {statusLabel[version.status]}</span>
          Effective {when(version.effectiveAt)} · Published {when(version.publishedAt)} · {data.acceptanceCount} acceptance{data.acceptanceCount === 1 ? "" : "s"}
        </div>
        {isDraft ? (
          <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
            <button type="button" onClick={() => setPreview(false)} className={`rounded-md px-2.5 py-1 text-xs ${!preview ? "bg-violet-500/20 text-white" : "text-slate-400"}`}><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
            <button type="button" onClick={() => setPreview(true)} className={`rounded-md px-2.5 py-1 text-xs ${preview ? "bg-violet-500/20 text-white" : "text-slate-400"}`}><Eye className="mr-1 inline h-3 w-3" />Preview</button>
          </div>
        ) : null}
      </div>

      {placeholders.length ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> {placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"} to fill in before this can be published</p>
          <p className="mt-1 text-amber-200/80">{placeholders.join(" · ")}</p>
        </div>
      ) : null}

      {isDraft && !preview ? (
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Document (Markdown: # headings, - lists, **bold**)
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={22} spellCheck className={`${input} mt-1 font-mono text-[13px] leading-6`} />
          </label>
          <label className="block text-xs text-slate-400">
            What changed (shown to readers)
            <input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={2000} className={`${input} mt-1`} />
          </label>
          {policy.requiredAtSignup ? (
            <>
              <label className="block text-xs text-slate-400">
                Acceptance wording (what people tick)
                <input value={consentText} onChange={(event) => setConsentText(event.target.value)} maxLength={500} className={`${input} mt-1`} />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" className="mt-0.5" checked={requiresConsent || firstPublication} disabled={firstPublication} onChange={(event) => setRequiresConsent(event.target.checked)} />
                <span>
                  Material change: everyone must accept this version again.
                  <span className="block text-slate-500">{firstPublication ? "Always on for the first published version." : "Leave off for typo fixes and clarifications."}</span>
                </span>
              </label>
            </>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0a0d14] p-4">
          <LegalMarkdown content={isDraft ? content : version.content} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        {isDraft ? (
          <>
            <button type="button" className={primary} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save draft
            </button>
            <button type="button" className={btn} disabled={dirty || transition.isPending} title={dirty ? "Save first" : undefined} onClick={() => transition.mutate({ action: "submit" })}>
              <Send className="h-3.5 w-3.5" /> Submit for review
            </button>
          </>
        ) : null}
        {version.status === "IN_REVIEW" ? (
          <>
            <button type="button" className={btn} disabled={transition.isPending} onClick={() => transition.mutate({ action: "return" })}>
              <Undo2 className="h-3.5 w-3.5" /> Back to draft
            </button>
            {canPublish ? (
              <button type="button" className={primary} disabled={transition.isPending || placeholders.length > 0} onClick={() => setConfirming("publish")} title={placeholders.length ? "Fill in the placeholders first" : undefined}>
                <ShieldCheck className="h-3.5 w-3.5" /> Publish…
              </button>
            ) : (
              <span className="text-xs text-slate-500">Waiting for an owner or executive to publish.</span>
            )}
          </>
        ) : null}
        {(version.status === "PUBLISHED" || version.status === "ARCHIVED") ? (
          <button type="button" className={btn} disabled={transition.isPending} onClick={() => transition.mutate({ action: "restore" })}>
            <RotateCcw className="h-3.5 w-3.5" /> Restore as new draft
          </button>
        ) : null}
        {canPublish && version.status === "PUBLISHED" ? (
          <button type="button" className={danger} onClick={() => setConfirming("withdraw")}><Archive className="h-3.5 w-3.5" /> Withdraw…</button>
        ) : null}
        {canPublish && (isDraft || version.status === "IN_REVIEW") ? (
          <button type="button" className={danger} onClick={() => setConfirming("discard")}><X className="h-3.5 w-3.5" /> Discard…</button>
        ) : null}
      </div>

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-950/20 p-4">
          {confirming === "publish" ? (
            <>
              <p className="text-sm font-semibold text-white">Publish version {version.version} of the {policy.title}?</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
                <li>It becomes the version shown at /legal/{policy.slug}; the current one (if any) is archived but stays in the history.</li>
                {policy.requiredAtSignup ? <li>{firstPublication || version.requiresConsent ? "Everyone will be asked to accept it the next time they open the app." : "Not marked as a material change: people who accepted an earlier version won't be asked again."}</li> : null}
                <li>Publishing doesn&apos;t mean the text has been legally reviewed. Make sure it has.</li>
              </ul>
              <label className="block text-xs text-slate-400">
                Effective date
                <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className={`${input} mt-1 max-w-[200px]`} />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" className="mt-0.5" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
                I&apos;ve checked the text, the operator details and the effective date.
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={primary}
                  disabled={!understood || !effectiveDate || transition.isPending}
                  onClick={() => transition.mutate({ action: "publish", confirm: true, effectiveAt: `${effectiveDate}T00:00:00.000Z`, requiresConsent: version.requiresConsent })}
                >
                  {transition.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Publish now
                </button>
                <button type="button" className={btn} onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">
                {confirming === "withdraw" ? `Withdraw version ${version.version}? The ${policy.title} will show as not published until a new version is published.` : `Discard version ${version.version}? It's kept in the database but never shown publicly.`}
              </p>
              <div className="flex gap-2">
                <button type="button" className={danger} disabled={transition.isPending} onClick={() => transition.mutate({ action: "archive" })}>
                  {confirming === "withdraw" ? "Withdraw" : "Discard"}
                </button>
                <button type="button" className={btn} onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AuditLog({ slug }: { slug: string }) {
  const { accessToken } = useAuthStore();
  const auditQuery = useQuery({ queryKey: ["legal-audit", slug, accessToken], queryFn: () => adminLegalAudit(accessToken!, slug), enabled: Boolean(accessToken) });
  const entries = auditQuery.data?.entries ?? [];
  const labels: Record<string, string> = {
    "version.create": "created",
    "version.edit": "edited",
    "version.submit": "submitted for review",
    "version.return": "sent back to draft",
    "version.publish": "published",
    "version.archive": "archived",
    "version.restore": "restored into",
  };
  if (auditQuery.isLoading) return <p className="text-sm text-slate-400">Loading...</p>;
  if (!entries.length) return <p className="text-sm text-slate-400">No changes recorded yet.</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-white/[0.06] bg-[#0d1119]/85 px-3 py-2 text-sm">
          <span className="font-semibold text-white">{entry.actorName}</span>
          <span className="text-slate-300">{labels[entry.action] ?? entry.action} version {entry.version ?? "?"}</span>
          {entry.details && "from" in entry.details && entry.action === "version.restore" ? <span className="text-slate-500">(from v{String(entry.details.from)})</span> : null}
          <span className="ml-auto text-[11px] text-slate-500">{when(entry.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
