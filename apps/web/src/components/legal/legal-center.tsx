"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, FileText, History, Link2, Loader2, Menu, Printer, Scale, Search, X } from "lucide-react";
import { getLegalPolicy, listLegalPolicies } from "@/lib/legal-api";
import { LegalMarkdown, parseLegal } from "@/components/legal/legal-markdown";

/** Effective dates are calendar dates (stored as UTC midnight), so show them in UTC: the same day everywhere. */
function formatDate(iso: string | null | undefined) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** The public Legal Center: every policy, its current text, and its published history. */
export function LegalCenter({ slug }: { slug: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedVersion = Number(searchParams?.get("version")) || undefined;
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const listQuery = useQuery({ queryKey: ["legal-policies"], queryFn: listLegalPolicies });
  const docQuery = useQuery({
    queryKey: ["legal-policy", slug, requestedVersion ?? "current"],
    queryFn: () => getLegalPolicy(slug!, requestedVersion),
    enabled: Boolean(slug),
    retry: false,
  });

  const policies = listQuery.data?.policies ?? [];
  const doc = docQuery.data;
  const version = doc?.version ?? null;
  const headings = useMemo(() => (version ? parseLegal(version.content).headings : []), [version]);
  const needle = query.trim().toLowerCase();
  const visiblePolicies = needle ? policies.filter((policy) => `${policy.title} ${policy.summary ?? ""}`.toLowerCase().includes(needle)) : policies;
  const visibleHeadings = needle ? headings.filter((heading) => heading.text.toLowerCase().includes(needle)) : headings;
  const viewingOld = Boolean(version && requestedVersion && version.status === "ARCHIVED");

  useEffect(() => {
    setNavOpen(false);
  }, [slug]);

  // Arriving on a #section link: scroll once the text has rendered.
  useEffect(() => {
    if (!version || typeof window === "undefined" || !window.location.hash) return;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    target?.scrollIntoView({ block: "start" });
  }, [version]);

  const copyLink = async (id?: string) => {
    const url = `${window.location.origin}/legal/${slug}${requestedVersion ? `?version=${requestedVersion}` : ""}${id ? `#${id}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id ?? "page");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const nav = (
    <nav aria-label="Legal documents" className="space-y-5">
      <label className="relative block">
        <span className="sr-only">Search the Legal Center</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search policies and sections"
          className="h-10 w-full rounded-xl border border-white/10 bg-[#11151e] pl-9 pr-8 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/60"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>

      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Documents</p>
        <ul className="space-y-0.5">
          {visiblePolicies.map((policy) => {
            const active = policy.slug === slug;
            return (
              <li key={policy.slug}>
                <Link
                  href={`/legal/${policy.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition ${active ? "bg-violet-500/15 text-white shadow-[inset_2px_0_0_#a78bfa]" : "text-slate-300 hover:bg-white/[0.04] hover:text-white"}`}
                >
                  <span className="min-w-0 truncate">{policy.title}</span>
                  {policy.published ? (
                    <span className="shrink-0 text-[10px] text-slate-500">v{policy.published.version}</span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-amber-400/40 px-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200">Draft</span>
                  )}
                </Link>
              </li>
            );
          })}
          {!visiblePolicies.length && !listQuery.isLoading ? <li className="px-2 text-xs text-slate-500">No documents match.</li> : null}
        </ul>
      </div>

      {slug && visibleHeadings.length ? (
        <div>
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">On this page</p>
          <ul className="space-y-0.5 border-l border-white/[0.06]">
            {visibleHeadings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={() => setNavOpen(false)}
                  className={`block truncate py-1 text-[13px] text-slate-400 transition hover:text-white ${heading.level === 3 ? "pl-6" : "pl-3"}`}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 print:bg-white print:text-black">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden print:hidden">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0e17]/85 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => setNavOpen((open) => !open)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden" aria-expanded={navOpen} aria-controls="legal-nav-mobile" aria-label="Legal menu">
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link href="/legal" className="flex items-center gap-2">
            <Image src="/brand/vexora-mark-gold-256.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
            <span className="nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white">Vexora</span>
            <span className="text-sm text-slate-400">Legal Center</span>
          </Link>
          <Link href="/app" className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-400/50 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-violet-500/60 via-amber-400/70 to-cyan-400/60" />
      </header>

      {navOpen ? (
        <div id="legal-nav-mobile" className="relative z-20 border-b border-white/[0.06] bg-[#0b0e17] px-4 py-4 lg:hidden print:hidden">
          {nav}
        </div>
      ) : null}

      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">{nav}</div>
        </aside>

        <main id="main-content" className="min-w-0">
          {!slug ? (
            <section>
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                <Scale className="h-3.5 w-3.5" /> Legal Center
              </p>
              <h1 className="nf-heading mt-4 text-3xl font-bold text-white sm:text-4xl">Policies and agreements</h1>
              <p className="mt-3 max-w-2xl text-slate-400">The terms that apply when you use Vexora Gaming. Each document shows the version in effect and when it changed.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {policies.map((policy) => (
                  <Link key={policy.slug} href={`/legal/${policy.slug}`} className="group rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-4 transition hover:-translate-y-0.5 hover:border-violet-400/40">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200"><FileText className="h-4 w-4" /></span>
                      {policy.published ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">In effect · v{policy.published.version}</span>
                      ) : (
                        <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">Draft · not published</span>
                      )}
                    </div>
                    <p className="mt-3 font-semibold text-white">{policy.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{policy.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : docQuery.isLoading ? (
            <p className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
          ) : docQuery.isError || !doc ? (
            <section className="rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-6">
              <h1 className="text-xl font-semibold text-white">Document not found</h1>
              <p className="mt-2 text-slate-400">There&apos;s no legal document at this address. <Link href="/legal" className="text-sky-300 underline">See all documents</Link>.</p>
            </section>
          ) : !version ? (
            <section className="rounded-2xl border border-amber-400/30 bg-amber-950/10 p-6">
              <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Draft · not yet published</span>
              <h1 className="nf-heading mt-3 text-2xl font-bold text-white">{doc.policy.title}</h1>
              <p className="mt-2 text-slate-300">This document hasn&apos;t been published yet, so it isn&apos;t in effect. It will appear here, with its effective date, once it is finalized.</p>
              {doc.policy.summary ? <p className="mt-2 text-sm text-slate-500">{doc.policy.summary}</p> : null}
            </section>
          ) : (
            <article className="rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-5 sm:p-8 print:border-0 print:bg-white print:p-0">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5 print:border-black/20">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300 print:text-black">{doc.policy.title}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <div className="flex gap-1.5"><dt className="text-slate-500">Effective</dt><dd className="font-semibold text-white print:text-black">{formatDate(version.effectiveAt)}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-slate-500">Last updated</dt><dd className="font-semibold text-white print:text-black">{formatDate(version.publishedAt)}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-slate-500">Version</dt><dd className="font-semibold text-white print:text-black">{version.version}</dd></div>
                  </dl>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  {doc.history.length > 1 ? (
                    <label className="relative inline-flex items-center">
                      <History className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                      <select
                        aria-label="Version history"
                        value={version.version}
                        onChange={(event) => {
                          const picked = Number(event.target.value);
                          const current = doc.history.find((entry) => entry.status === "PUBLISHED")?.version;
                          router.push(picked === current ? `/legal/${slug}` : `/legal/${slug}?version=${picked}`);
                        }}
                        className="h-9 appearance-none rounded-lg border border-white/10 bg-[#11151e] pl-8 pr-7 text-xs text-slate-200 outline-none focus:border-violet-400/60"
                      >
                        {doc.history.map((entry) => (
                          <option key={entry.version} value={entry.version}>
                            v{entry.version} · {formatDate(entry.effectiveAt ?? entry.publishedAt)}{entry.status === "PUBLISHED" ? " (current)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
                    </label>
                  ) : null}
                  <button type="button" onClick={() => void copyLink()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 transition hover:border-sky-400/50 hover:text-white">
                    {copied === "page" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {copied === "page" ? "Copied" : "Copy link"}
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 transition hover:border-sky-400/50 hover:text-white">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                </div>
              </div>

              {viewingOld ? (
                <p className="mb-5 rounded-xl border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 print:border-black/30 print:text-black">
                  You&apos;re viewing version {version.version}, which is no longer in effect.{" "}
                  <Link href={`/legal/${slug}`} className="font-semibold underline print:hidden">See the current version</Link>
                </p>
              ) : null}
              {version.changeSummary && !viewingOld ? (
                <p className="mb-5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3 text-sm text-slate-300 print:hidden">
                  <span className="font-semibold text-sky-200">What changed: </span>{version.changeSummary}
                </p>
              ) : null}

              <LegalMarkdown content={version.content} onCopySection={(id) => void copyLink(id)} />
              {copied && copied !== "page" ? (
                <p role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-sky-400/40 bg-[#0d1119] px-4 py-2 text-xs text-sky-100 shadow-xl print:hidden">Link to section copied</p>
              ) : null}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
