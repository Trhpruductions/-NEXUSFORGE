"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { deleteUpdate, getApiErrorMessage, listAllUpdatesForStaff, publishUpdate, saveUpdate, type AppUpdate } from "@/lib/api";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { useAuthStore } from "@/store/auth-store";

const input = "w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60";

/** Staff: write "What's new" updates and publish them to everyone. */
export function UpdatesAdmin() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["updates-admin", accessToken], queryFn: () => listAllUpdatesForStaff(accessToken!), enabled: Boolean(accessToken) });
  const [editing, setEditing] = useState<AppUpdate | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["updates-admin"] });
  const reset = () => {
    setEditing(null);
    setTitle("");
    setVersion("");
    setBody("");
    setPreview(false);
  };
  const edit = (update: AppUpdate) => {
    setEditing(update);
    setTitle(update.title);
    setVersion(update.version ?? "");
    setBody(update.body);
    setPreview(false);
    setNotice(null);
  };

  const save = useMutation({
    mutationFn: () => saveUpdate(accessToken!, csrfToken!, { title, body, version: version || null }, editing?.id),
    onSuccess: async (update) => {
      setNotice({ tone: "ok", text: update.publishedAt ? "Saved." : "Draft saved. Publish it when it's ready." });
      setEditing(update);
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const publish = useMutation({
    mutationFn: (id: string) => publishUpdate(accessToken!, csrfToken!, id),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Published. It's popping up for everyone now." });
      reset();
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteUpdate(accessToken!, csrfToken!, id),
    onSuccess: async () => {
      reset();
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const ready = title.trim().length >= 3 && body.trim().length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0d1119] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{editing ? (editing.publishedAt ? "Edit published update" : "Edit draft") : "New update"}</h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPreview(false)} className={`rounded-md px-2.5 py-1 text-xs ${!preview ? "bg-violet-500/20 text-white" : "text-slate-400"}`}><Pencil className="mr-1 inline h-3 w-3" />Write</button>
            <button type="button" onClick={() => setPreview(true)} className={`rounded-md px-2.5 py-1 text-xs ${preview ? "bg-violet-500/20 text-white" : "text-slate-400"}`}><Eye className="mr-1 inline h-3 w-3" />Preview</button>
          </div>
        </div>
        {preview ? (
          <div className="rounded-xl border border-white/10 p-4">
            <h3 className="text-lg font-bold text-white">{title || "Title"}</h3>
            <LegalMarkdown content={body || "Nothing written yet."} />
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Title, e.g. Polls, stickers and a soundboard" aria-label="Title" className={input} />
              <input value={version} onChange={(event) => setVersion(event.target.value)} maxLength={24} placeholder="Version (optional)" aria-label="Version" className={input} />
            </div>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} rows={12} placeholder={"What changed? Markdown works:\n\n## New\n- Polls in channels\n- **Stickers** and a soundboard\n\n## Fixed\n- Long messages no longer get cut off"} aria-label="What changed" className={`${input} font-mono text-xs leading-5`} />
          </>
        )}
        {notice ? <p className={`text-xs ${notice.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{notice.text}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || save.isPending} onClick={() => save.mutate()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:border-violet-400/50 disabled:opacity-40">
            {save.isPending ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}{editing ? "Save" : "Save draft"}
          </button>
          {editing && !editing.publishedAt ? (
            <button type="button" disabled={publish.isPending} onClick={() => { if (window.confirm("Publish this update? It pops up for everyone using Nexus Forge.")) publish.mutate(editing.id); }} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> Publish to everyone
            </button>
          ) : null}
          {editing ? <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-white">New update</button> : null}
        </div>
      </section>
      <section className="space-y-2 rounded-2xl border border-white/10 bg-[#0d1119] p-4">
        <h2 className="text-sm font-semibold text-white">All updates</h2>
        {query.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : null}
        {(query.data ?? []).map((update) => (
          <div key={update.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${editing?.id === update.id ? "border-violet-400/50" : "border-white/5"}`}>
            <button type="button" onClick={() => edit(update)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-slate-100">{update.title}</span>
              <span className="text-[11px] text-slate-500">{update.publishedAt ? `Published ${new Date(update.publishedAt).toLocaleDateString()}` : "Draft"}{update.version ? ` · ${update.version}` : ""}</span>
            </button>
            <button type="button" onClick={() => { if (window.confirm(`Delete "${update.title}"?`)) remove.mutate(update.id); }} className="rounded p-1 text-slate-500 hover:text-rose-300" aria-label={`Delete ${update.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {query.data && !query.data.length ? <p className="text-sm text-slate-500">No updates yet.</p> : null}
      </section>
    </div>
  );
}
