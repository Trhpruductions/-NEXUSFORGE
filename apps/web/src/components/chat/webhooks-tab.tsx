"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { createWebhook, deleteWebhook, getApiErrorMessage, listWebhooks, resetWebhook, updateWebhook, type ForgeDetail } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

const input = "h-9 rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-violet-400/60";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 disabled:opacity-40";

/** Forge settings > Webhooks (manage channels): secret URLs that post into a channel. */
export function WebhooksTab({ forge, setNotice }: { forge: ForgeDetail; setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const queryScope = useQueryScope();
  const textChannels = forge.channels.filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT");
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState(textChannels[0]?.id ?? "");
  const [secret, setSecret] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const key = ["webhooks", forge.id, queryScope];
  const listQuery = useQuery({ queryKey: key, queryFn: () => listWebhooks(accessToken!, forge.id), enabled: Boolean(accessToken) });
  const webhooks = listQuery.data?.webhooks ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["webhooks", forge.id] });
  const channelName = (id: string) => forge.channels.find((channel) => channel.id === id)?.name ?? "deleted-channel";

  const create = useMutation({
    mutationFn: () => createWebhook(accessToken!, csrfToken!, forge.id, { name: name.trim(), channelId }),
    onSuccess: async (result) => {
      setSecret({ id: result.webhook.id, url: result.url });
      setName("");
      setNotice({ tone: "ok", text: `Webhook "${result.webhook.name}" created. Copy its URL now; it won't be shown again.` });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const reset = useMutation({
    mutationFn: (id: string) => resetWebhook(accessToken!, csrfToken!, forge.id, id),
    onSuccess: (result, id) => {
      setSecret({ id, url: result.url });
      setNotice({ tone: "ok", text: "New URL made. The old one has stopped working." });
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const move = useMutation({
    mutationFn: (input: { id: string; channelId: string }) => updateWebhook(accessToken!, csrfToken!, forge.id, input.id, { channelId: input.channelId }),
    onSuccess: () => refresh(),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteWebhook(accessToken!, csrfToken!, forge.id, id),
    onSuccess: async () => {
      setConfirmDelete(null);
      setNotice({ tone: "ok", text: "Webhook deleted." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice({ tone: "error", text: "Couldn't copy. Select the URL and copy it by hand." });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-200"><Webhook className="h-5 w-5" /></span>
        <p className="text-xs text-slate-300">
          A webhook is a secret URL that lets another app post into a channel: stream alerts, game-server logs, GitHub updates. Anyone with the URL can post, so keep it private. Webhook posts never ping anyone.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <label className="text-xs text-slate-400">Name<input className={`${input} mt-1 block w-48`} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Stream alerts" /></label>
        <label className="text-xs text-slate-400">
          Posts in
          <select className={`${input} mt-1 block`} value={channelId} onChange={(event) => setChannelId(event.target.value)}>
            {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!name.trim() || !channelId || create.isPending} onClick={() => create.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create webhook
        </button>
      </div>

      {secret ? (
        <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-100">Copy this URL now. For your security it won&apos;t be shown again (you can make a new one later).</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-[#0a0d14] px-2 py-1.5 text-[11px] text-slate-100">{secret.url}</code>
            <button type="button" className={btn} onClick={() => void copy(secret.url)}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="text-[11px] text-slate-400">Try it: <code className="text-slate-300">curl -X POST -H &quot;Content-Type: application/json&quot; -d &apos;{`{"content":"Hello from my webhook"}`}&apos; &lt;URL&gt;</code></p>
          <button type="button" className="text-[11px] text-slate-400 hover:text-white" onClick={() => setSecret(null)}>I&apos;ve saved it</button>
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : webhooks.length ? (
        <ul className="space-y-1.5">
          {webhooks.map((webhook) => (
            <li key={webhook.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0d1119]/85 px-3 py-2">
              <Webhook className="h-4 w-4 shrink-0 text-sky-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{webhook.name}</p>
                <p className="text-[11px] text-slate-500">
                  #{channelName(webhook.channelId)} · {webhook.lastUsedAt ? `last used ${new Date(webhook.lastUsedAt).toLocaleString()}` : "never used"}
                </p>
              </div>
              <select aria-label="Move to channel" className="h-8 rounded-lg border border-white/10 bg-[#11151e] px-2 text-xs text-slate-200" value={webhook.channelId} disabled={move.isPending} onChange={(event) => move.mutate({ id: webhook.id, channelId: event.target.value })}>
                {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
              </select>
              <button type="button" className={btn} title="Make a new secret URL" disabled={reset.isPending} onClick={() => reset.mutate(webhook.id)}><RefreshCw className="h-3.5 w-3.5" /> New URL</button>
              {confirmDelete === webhook.id ? (
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 text-xs font-semibold text-rose-100" disabled={remove.isPending} onClick={() => remove.mutate(webhook.id)}>Confirm delete</button>
              ) : (
                <button type="button" className={btn} title="Delete webhook" onClick={() => setConfirmDelete(webhook.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No webhooks yet.</p>
      )}
    </div>
  );
}
