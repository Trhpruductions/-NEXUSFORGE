"use client";

import Link from "next/link";
import { Bot, Loader2, Megaphone } from "lucide-react";
import type { PublicDeveloperBot, PublicDeveloperUpdate } from "@/lib/api";
import { LegalMarkdown } from "@/components/legal/legal-markdown";

type QueryState<T> = { data: T | undefined; loading: boolean; failed: boolean };

/** Published updates to the app. Shown to everyone on the developer section, no sign-in needed. */
export function DeveloperUpdates({ data, loading, failed }: QueryState<PublicDeveloperUpdate[]>) {
  return (
    <section aria-labelledby="developer-updates" className="mb-6 space-y-4">
      <header>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
          <Megaphone className="h-3.5 w-3.5" /> Updates to the app
        </p>
        <h2 id="developer-updates" className="mt-1 text-xl font-semibold text-white">What&apos;s new</h2>
        <p className="text-sm text-slate-400">Published release notes for Nexus Forge Gaming, newest first.</p>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading updates...
        </p>
      ) : failed ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-950/20 p-4 text-sm text-rose-200">
          The updates could not be loaded right now. Try again in a moment.
        </p>
      ) : !data?.length ? (
        <p className="rounded-xl border border-white/10 bg-[#0d1119] p-5 text-sm text-slate-400">No updates have been published yet.</p>
      ) : (
        data.map((update) => (
          <article key={update.id} className="rounded-2xl border border-white/10 bg-[#0d1119] p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {update.version ? (
                <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-amber-200">{update.version}</span>
              ) : null}
              <span>{new Date(update.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">{update.title}</h3>
            <div className="mt-2">
              <LegalMarkdown content={update.body} />
            </div>
          </article>
        ))
      )}
    </section>
  );
}

/**
 * Public bot apps. Install codes are only shown to signed-in people, so a visitor is pointed to sign in for one.
 */
export function PublicBots({ data, loading, failed }: QueryState<PublicDeveloperBot[]>) {
  return (
    <section aria-labelledby="public-bots" className="mb-6 space-y-4">
      <header>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
          <Bot className="h-3.5 w-3.5" /> Marketplace
        </p>
        <h2 id="public-bots" className="mt-1 text-xl font-semibold text-white">Public bots</h2>
        <p className="text-sm text-slate-400">Bots other developers have published on Nexus Forge Gaming.</p>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading public bots...
        </p>
      ) : failed ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-950/20 p-4 text-sm text-rose-200">
          The public bots could not be loaded right now. Try again in a moment.
        </p>
      ) : !data?.length ? (
        <p className="rounded-xl border border-white/10 bg-[#0d1119] p-5 text-sm text-slate-400">No public bots yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((bot) => (
            <div key={bot.id} className="rounded-2xl border border-white/10 bg-[#0d1119] p-4">
              <p className="font-semibold text-white">{bot.name}</p>
              <p className="mt-1 text-sm text-slate-400">{bot.description ?? "No description provided."}</p>
              <p className="mt-3 text-xs text-slate-500">
                <Link href="/login?redirect=/developer" className="font-semibold text-amber-200 underline underline-offset-4">
                  Sign in to get the invite code
                </Link>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
