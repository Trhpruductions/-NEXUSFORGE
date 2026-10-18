"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Bot, Check, Link2, Loader2, Plus, ShieldAlert, Trash2, Type, UserPlus } from "lucide-react";
import { createAutoModRule, deleteAutoModRule, getApiErrorMessage, listAutoModRules, updateAutoModRule, type AutoModRule, type ForgeDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const input = "w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/60";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 disabled:opacity-40";
const primary = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-40";

type Draft = Omit<AutoModRule, "id" | "forgeId" | "createdAt" | "updatedAt" | "position" | "createdById">;

const typeInfo: Record<AutoModRule["type"], { label: string; icon: typeof Type; color: string; hint: string }> = {
  KEYWORDS: { label: "Blocked words", icon: Type, color: "text-rose-300", hint: "Words or phrases. Use * as a wildcard (scam* also catches scammer). Look-alike spellings like fr33 are caught too." },
  LINKS: { label: "Links", icon: Link2, color: "text-sky-300", hint: "Web links (http and https) and common domains, except domains you allow (subdomains included)." },
  INVITES: { label: "Other server invites", icon: UserPlus, color: "text-amber-300", hint: "Invites to other forges or Discord servers. This forge's own invites are always fine." },
  MENTION_SPAM: { label: "Mention spam", icon: AtSign, color: "text-violet-300", hint: "Messages that mention more people than the limit." },
};

const presets: Array<{ title: string; draft: Draft }> = [
  {
    title: "Block slurs and scams",
    draft: { name: "Slurs and scams", enabled: true, type: "KEYWORDS", keywords: ["free nitro", "free coins", "free skins", "steam gift", "claim your prize"], allowList: [], mentionLimit: null, blockMessage: true, alertModerators: true, timeoutMinutes: null, customMessage: "That message was blocked. Scam links and slurs aren't allowed here.", exemptRoleIds: [], exemptChannelIds: [] },
  },
  {
    title: "Block other servers' invites",
    draft: { name: "No other server invites", enabled: true, type: "INVITES", keywords: [], allowList: [], mentionLimit: null, blockMessage: true, alertModerators: false, timeoutMinutes: null, customMessage: "Please don't advertise other servers here.", exemptRoleIds: [], exemptChannelIds: [] },
  },
  {
    title: "Stop mention spam",
    draft: { name: "Mention spam", enabled: true, type: "MENTION_SPAM", keywords: [], allowList: [], mentionLimit: 5, blockMessage: true, alertModerators: true, timeoutMinutes: 10, customMessage: "Too many mentions in one message.", exemptRoleIds: [], exemptChannelIds: [] },
  },
  {
    title: "Only allow trusted links",
    draft: { name: "Trusted links only", enabled: true, type: "LINKS", keywords: [], allowList: ["youtube.com", "youtu.be", "twitch.tv", "kick.com", "steampowered.com", "tenor.com", "giphy.com"], mentionLimit: null, blockMessage: true, alertModerators: false, timeoutMinutes: null, customMessage: "Links from that site aren't allowed here.", exemptRoleIds: [], exemptChannelIds: [] },
  },
];

const splitList = (text: string) => text.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);

function RuleEditor({ forge, initial, onSave, onCancel, saving }: { forge: ForgeDetail; initial: Draft; onSave: (draft: Draft) => void; onCancel: () => void; saving: boolean }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [words, setWords] = useState(initial.keywords.join("\n"));
  const [allow, setAllow] = useState(initial.allowList.join("\n"));
  const info = typeInfo[draft.type];
  const roles = forge.roles.filter((role) => role.position < 100);
  const textChannels = forge.channels.filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT");
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);

  return (
    <div className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-950/10 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <label className="text-xs text-slate-400">Rule name<input className={`${input} mt-1`} value={draft.name} maxLength={60} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="text-xs text-slate-400">
          Type
          <select className={`${input} mt-1`} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft["type"] })}>
            {Object.entries(typeInfo).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-slate-400">{info.hint}</p>
      {draft.type === "KEYWORDS" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Block these (one per line)<textarea className={`${input} mt-1 min-h-[96px] font-mono text-xs`} value={words} onChange={(event) => setWords(event.target.value)} /></label>
          <label className="text-xs text-slate-400">But allow these phrases (optional)<textarea className={`${input} mt-1 min-h-[96px] font-mono text-xs`} value={allow} onChange={(event) => setAllow(event.target.value)} /></label>
        </div>
      ) : null}
      {draft.type === "LINKS" ? (
        <label className="block text-xs text-slate-400">Allowed domains (one per line)<textarea className={`${input} mt-1 min-h-[80px] font-mono text-xs`} value={allow} onChange={(event) => setAllow(event.target.value)} placeholder="youtube.com" /></label>
      ) : null}
      {draft.type === "MENTION_SPAM" ? (
        <label className="block text-xs text-slate-400">
          Most mentions allowed in one message
          <input type="number" min={1} max={50} className={`${input} mt-1 max-w-[120px]`} value={draft.mentionLimit ?? 5} onChange={(event) => setDraft({ ...draft, mentionLimit: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} />
        </label>
      ) : null}

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">When it matches</legend>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={draft.blockMessage} onChange={(event) => setDraft({ ...draft, blockMessage: event.target.checked })} /> Block the message</label>
        {draft.blockMessage ? (
          <input className={`${input} text-xs`} maxLength={150} placeholder="Message shown to the sender (optional)" value={draft.customMessage ?? ""} onChange={(event) => setDraft({ ...draft, customMessage: event.target.value || null })} />
        ) : null}
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={draft.alertModerators} onChange={(event) => setDraft({ ...draft, alertModerators: event.target.checked })} /> Alert moderators</label>
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
          Time out the sender:
          <select className="h-8 rounded-lg border border-white/10 bg-[#11151e] px-2 text-xs text-slate-100" value={draft.timeoutMinutes ?? 0} onChange={(event) => setDraft({ ...draft, timeoutMinutes: Number(event.target.value) ? (Number(event.target.value) as Draft["timeoutMinutes"]) : null })}>
            <option value={0}>No</option>
            <option value={1}>60 seconds</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={60}>1 hour</option>
            <option value={1440}>1 day</option>
            <option value={10080}>1 week</option>
          </select>
        </label>
      </fieldset>

      {roles.length || textChannels.length ? (
        <details className="text-xs text-slate-300">
          <summary className="cursor-pointer text-slate-400">Exemptions ({draft.exemptRoleIds.length + draft.exemptChannelIds.length})</summary>
          <p className="mt-1 text-[11px] text-slate-500">The owner and anyone who can manage the forge are always exempt.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <button key={role.id} type="button" onClick={() => setDraft({ ...draft, exemptRoleIds: toggle(draft.exemptRoleIds, role.id) })} className={`rounded-full border px-2 py-0.5 ${draft.exemptRoleIds.includes(role.id) ? "bg-slate-800" : ""}`} style={{ borderColor: draft.exemptRoleIds.includes(role.id) ? role.color : "#334155", color: draft.exemptRoleIds.includes(role.id) ? role.color : "#94a3b8" }}>
                {draft.exemptRoleIds.includes(role.id) ? "✓ " : ""}{role.name}
              </button>
            ))}
            {textChannels.map((channel) => (
              <button key={channel.id} type="button" onClick={() => setDraft({ ...draft, exemptChannelIds: toggle(draft.exemptChannelIds, channel.id) })} className={`rounded-full border px-2 py-0.5 ${draft.exemptChannelIds.includes(channel.id) ? "border-sky-400/60 bg-sky-500/10 text-sky-200" : "border-slate-700 text-slate-400"}`}>
                {draft.exemptChannelIds.includes(channel.id) ? "✓ " : ""}#{channel.name}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className={primary} disabled={saving || !draft.name.trim()} onClick={() => onSave({ ...draft, keywords: draft.type === "KEYWORDS" ? splitList(words) : [], allowList: draft.type === "KEYWORDS" || draft.type === "LINKS" ? splitList(allow) : [], mentionLimit: draft.type === "MENTION_SPAM" ? draft.mentionLimit ?? 5 : null })}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save rule
        </button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Forge settings > AutoMod (manage forge). */
export function AutoModTab({ forge, setNotice }: { forge: ForgeDetail; setNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const key = ["automod", forge.id, accessToken];
  const rulesQuery = useQuery({ queryKey: key, queryFn: () => listAutoModRules(accessToken!, forge.id), enabled: Boolean(accessToken) });
  const rules = rulesQuery.data?.rules ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["automod", forge.id] });

  const save = useMutation({
    mutationFn: (input: { id: string | null; draft: Draft }) => (input.id ? updateAutoModRule(accessToken!, csrfToken!, forge.id, input.id, input.draft) : createAutoModRule(accessToken!, csrfToken!, forge.id, input.draft)),
    onSuccess: async () => {
      setEditing(null);
      setNotice({ tone: "ok", text: "AutoMod rule saved." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const toggle = useMutation({
    mutationFn: (rule: AutoModRule) => updateAutoModRule(accessToken!, csrfToken!, forge.id, rule.id, { enabled: !rule.enabled }),
    onSuccess: () => refresh(),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: (rule: AutoModRule) => deleteAutoModRule(accessToken!, csrfToken!, forge.id, rule.id),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Rule deleted." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#0d1119]/85 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200"><Bot className="h-5 w-5" /></span>
        <p className="text-xs text-slate-300">AutoMod checks every message (and edit) before it&apos;s posted. Matches can be blocked, sent to moderators, or get the sender timed out. Everything it does is in the Audit log.</p>
      </div>

      {editing ? (
        <RuleEditor forge={forge} initial={editing.draft} saving={save.isPending} onCancel={() => setEditing(null)} onSave={(draft) => save.mutate({ id: editing.id, draft })} />
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Add a rule</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => {
              const info = typeInfo[preset.draft.type];
              return (
                <button key={preset.title} type="button" onClick={() => setEditing({ id: null, draft: preset.draft })} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#11151e] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-violet-400/40">
                  <info.icon className={`h-4 w-4 shrink-0 ${info.color}`} /> {preset.title}
                </button>
              );
            })}
          </div>
          <button type="button" className={btn} onClick={() => setEditing({ id: null, draft: { ...presets[0].draft, name: "New rule", keywords: [], customMessage: null } })}><Plus className="h-3.5 w-3.5" /> Blank rule</button>
        </div>
      )}

      {rulesQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading rules...</p>
      ) : rules.length ? (
        <ul className="space-y-1.5">
          {rules.map((rule) => {
            const info = typeInfo[rule.type];
            return (
              <li key={rule.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0d1119]/85 px-3 py-2 ${rule.enabled ? "" : "opacity-60"}`}>
                <info.icon className={`h-4 w-4 shrink-0 ${info.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{rule.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {info.label}
                    {rule.type === "KEYWORDS" ? ` · ${rule.keywords.length} word${rule.keywords.length === 1 ? "" : "s"}` : ""}
                    {rule.type === "MENTION_SPAM" ? ` · over ${rule.mentionLimit}` : ""}
                    {" · "}
                    {[rule.blockMessage ? "block" : null, rule.alertModerators ? "alert" : null, rule.timeoutMinutes ? `timeout ${rule.timeoutMinutes}m` : null].filter(Boolean).join(", ")}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={rule.enabled} disabled={toggle.isPending} onChange={() => toggle.mutate(rule)} /> On</label>
                <button type="button" className={btn} onClick={() => setEditing({ id: rule.id, draft: rule })}>Edit</button>
                <button type="button" className={btn} title="Delete rule" disabled={remove.isPending} onClick={() => remove.mutate(rule)}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
      ) : !editing ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><ShieldAlert className="h-4 w-4" /> No rules yet. Pick a starting point above.</p>
      ) : null}
    </div>
  );
}
