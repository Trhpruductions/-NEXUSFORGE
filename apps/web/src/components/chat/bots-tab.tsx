"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Loader2, Pencil, Plus, Search } from "lucide-react";
import {
  createBotCommand,
  getApiErrorMessage,
  installBotToForge,
  listBotCatalog,
  setBotInstallationEnabled,
  updateBotCommand,
  type BotCommand,
  type ForgeDetail,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const input = "w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/60";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 disabled:opacity-40";
const primary = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-40";

type Notice = (notice: { tone: "ok" | "error"; text: string } | null) => void;
type Permission = BotCommand["requiredPermission"];

const permissionLabels: Record<Permission, string> = {
  NONE: "Everyone",
  moderateChat: "Moderators",
  manageChannels: "Can manage channels",
  manageRoles: "Can manage roles",
  kickUsers: "Can kick",
  banUsers: "Can ban",
  streamAccess: "Can stream",
};

type CommandDraft = { name: string; description: string; responseTemplate: string; requiredPermission: Permission };
const emptyDraft: CommandDraft = { name: "", description: "", responseTemplate: "", requiredPermission: "NONE" };

/** Server owners: add bots to the forge and set up the /commands people can run in chat. */
export function BotsTab({ forge, setNotice, invalidate }: { forge: ForgeDetail; setNotice: Notice; invalidate: () => Promise<void> }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommandDraft>(emptyDraft);

  const installedBotIds = new Set(forge.botInstallations.map((installation) => installation.bot.id));
  const catalog = useQuery({
    queryKey: ["bot-catalog", search, accessToken],
    queryFn: () => listBotCatalog(accessToken!, search.trim() || undefined),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const done = async (text: string) => {
    setNotice({ tone: "ok", text });
    await invalidate();
    await queryClient.invalidateQueries({ queryKey: ["forge", forge.id] });
  };
  const failed = (error: unknown) => setNotice({ tone: "error", text: getApiErrorMessage(error) });

  const install = useMutation({
    mutationFn: (code: string) => installBotToForge(accessToken!, csrfToken!, { forgeId: forge.id, inviteCode: code.trim() }),
    onSuccess: async (result) => {
      setInviteCode("");
      await done(`${result.installation.bot.name} was added to ${forge.name}.`);
    },
    onError: failed,
  });
  const toggleBot = useMutation({
    mutationFn: (payload: { id: string; enabled: boolean }) => setBotInstallationEnabled(accessToken!, csrfToken!, payload.id, payload.enabled),
    onSuccess: (_result, payload) => done(payload.enabled ? "Bot switched on." : "Bot switched off. Its commands stop working until you switch it back on."),
    onError: failed,
  });
  const saveCommand = useMutation({
    mutationFn: async (payload: { installationId: string; commandId?: string }) => {
      if (payload.commandId) {
        return updateBotCommand(accessToken!, csrfToken!, payload.commandId, {
          description: draft.description || undefined,
          responseTemplate: draft.responseTemplate,
          requiredPermission: draft.requiredPermission,
        });
      }
      return createBotCommand(accessToken!, csrfToken!, {
        forgeId: forge.id,
        installationId: payload.installationId,
        name: draft.name.trim().replace(/^\//, ""),
        description: draft.description || undefined,
        responseTemplate: draft.responseTemplate,
        requiredPermission: draft.requiredPermission,
      });
    },
    onSuccess: async (_result, payload) => {
      setAdding(null);
      setEditing(null);
      setDraft(emptyDraft);
      await done(payload.commandId ? "Command saved." : `/${draft.name.trim().replace(/^\//, "")} is ready. Type it in any channel.`);
    },
    onError: failed,
  });
  const toggleCommand = useMutation({
    mutationFn: (command: BotCommand) => updateBotCommand(accessToken!, csrfToken!, command.id, { enabled: !command.enabled }),
    onSuccess: (_result, command) => done(command.enabled ? `/${command.name} switched off.` : `/${command.name} switched on.`),
    onError: failed,
  });

  const commandForm = (installationId: string, command?: BotCommand) => (
    <div className="mt-2 space-y-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.04] p-3">
      {!command ? (
        <label className="block text-xs text-slate-300">
          Command name
          <input className={`${input} mt-1`} value={draft.name} maxLength={40} placeholder="rules" onChange={(event) => setDraft({ ...draft, name: event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() })} />
        </label>
      ) : null}
      <label className="block text-xs text-slate-300">
        What it does (shown when people type /)
        <input className={`${input} mt-1`} value={draft.description} maxLength={180} placeholder="Shows the server rules" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>
      <label className="block text-xs text-slate-300">
        Bot&apos;s reply
        <textarea className={`${input} mt-1 min-h-[72px]`} value={draft.responseTemplate} maxLength={1200} placeholder="Welcome {user}! Read #rules before posting in {forge}." onChange={(event) => setDraft({ ...draft, responseTemplate: event.target.value })} />
        <span className="mt-1 block text-[11px] text-slate-500">You can use {"{user}"} (mentions the person), {"{userName}"}, {"{forge}"}, {"{channel}"} and {"{args}"} (whatever they typed after the command).</span>
      </label>
      <label className="block text-xs text-slate-300">
        Who can use it
        <select className={`${input} mt-1`} value={draft.requiredPermission} onChange={(event) => setDraft({ ...draft, requiredPermission: event.target.value as Permission })}>
          {(Object.keys(permissionLabels) as Permission[]).map((key) => (
            <option key={key} value={key}>{permissionLabels[key]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={primary}
          disabled={saveCommand.isPending || !draft.responseTemplate.trim() || (!command && draft.name.length < 2)}
          onClick={() => saveCommand.mutate({ installationId, commandId: command?.id })}
        >
          {saveCommand.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {command ? "Save" : "Add command"}
        </button>
        <button type="button" className={btn} onClick={() => { setAdding(null); setEditing(null); setDraft(emptyDraft); }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Bots answer /commands in your channels. Add one, then set up the commands people can type.</p>

      {/* Installed */}
      {forge.botInstallations.length ? (
        <div className="space-y-3">
          {forge.botInstallations.map((installation) => (
            <div key={installation.id} className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Bot className="h-4 w-4 text-violet-300" />
                <p className="text-sm font-semibold text-white">{installation.bot.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${installation.enabled ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700/40 text-slate-400"}`}>{installation.enabled ? "On" : "Off"}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" className={btn} disabled={toggleBot.isPending} onClick={() => toggleBot.mutate({ id: installation.id, enabled: !installation.enabled })}>
                    {installation.enabled ? "Switch off" : "Switch on"}
                  </button>
                  <button type="button" className={btn} onClick={() => { setAdding(installation.id); setEditing(null); setDraft(emptyDraft); }}>
                    <Plus className="h-3.5 w-3.5" /> Command
                  </button>
                </span>
              </div>
              {installation.bot.description ? <p className="mt-1 text-xs text-slate-400">{installation.bot.description}</p> : null}

              <ul className="mt-2 space-y-1.5">
                {installation.commands.map((command) => (
                  <li key={command.id} className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className={`text-sm ${command.enabled ? "text-amber-200" : "text-slate-500 line-through"}`}>/{command.name}</code>
                      <span className="text-xs text-slate-400">{command.description || "No description"}</span>
                      <span className="text-[10px] text-slate-500">· {permissionLabels[command.requiredPermission]}</span>
                      <span className="ml-auto flex gap-1.5">
                        <button
                          type="button"
                          className={btn}
                          aria-label={`Edit /${command.name}`}
                          onClick={() => {
                            setEditing(command.id);
                            setAdding(null);
                            setDraft({ name: command.name, description: command.description ?? "", responseTemplate: command.responseTemplate, requiredPermission: command.requiredPermission });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className={btn} disabled={toggleCommand.isPending} onClick={() => toggleCommand.mutate(command)}>
                          {command.enabled ? "Off" : "On"}
                        </button>
                      </span>
                    </div>
                    {editing === command.id ? commandForm(installation.id, command) : null}
                  </li>
                ))}
                {!installation.commands.length && adding !== installation.id ? <li className="text-xs text-slate-500">No commands yet.</li> : null}
              </ul>
              {adding === installation.id ? commandForm(installation.id) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-[#0d1119] p-3 text-sm text-slate-400">No bots in {forge.name} yet.</p>
      )}

      {/* Add */}
      <div className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Add a bot</p>
        <div className="flex gap-2">
          <input className={input} value={inviteCode} placeholder="Bot invite code" aria-label="Bot invite code" onChange={(event) => setInviteCode(event.target.value)} />
          <button type="button" className={primary} disabled={!inviteCode.trim() || install.isPending} onClick={() => install.mutate(inviteCode)}>
            {install.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input className={`${input} pl-8`} value={search} placeholder="Search public bots" aria-label="Search public bots" onChange={(event) => setSearch(event.target.value)} />
        </div>
        <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
          {catalog.isLoading ? <li className="text-xs text-slate-500">Loading bots…</li> : null}
          {(catalog.data?.bots ?? []).map((bot) => (
            <li key={bot.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
              <Bot className="h-4 w-4 shrink-0 text-violet-300" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{bot.name}</span>
                {bot.description ? <span className="block truncate text-[11px] text-slate-500">{bot.description}</span> : null}
              </span>
              {installedBotIds.has(bot.id) ? (
                <span className="text-[11px] text-emerald-300">Added</span>
              ) : (
                <button type="button" className={btn} disabled={install.isPending} onClick={() => install.mutate(bot.inviteCode)}>Add</button>
              )}
            </li>
          ))}
          {catalog.data && !catalog.data.bots.length ? <li className="text-xs text-slate-500">No public bots match.</li> : null}
        </ul>
      </div>
    </div>
  );
}
