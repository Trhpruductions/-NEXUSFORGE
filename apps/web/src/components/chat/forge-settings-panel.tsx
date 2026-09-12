"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { X, Hash, Volume2, Megaphone, Radio, Plus, Trash2, Pencil, Check, ShieldAlert, Ban, LogOut, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import {
  banForgeUser,
  createForgeChannel,
  createForgeRole,
  deleteForge,
  deleteForgeChannel,
  deleteForgeRole,
  forgePermissionKeys,
  getForge,
  getForgePermissions,
  kickForgeMember,
  leaveForge,
  listForgeBans,
  setForgeMemberRoles,
  unbanForgeUser,
  updateForge,
  updateForgeChannel,
  updateForgeMemberNickname,
  updateForgeRole,
  type Channel,
  type ForgeDetail,
  type ForgeMemberEntry,
  type ForgePermissionKey,
  type ForgePermissionSet,
  type ForgeRole,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type Tab = "overview" | "channels" | "roles" | "members" | "bans" | "danger";

const permissionLabels: Record<ForgePermissionKey, { label: string; hint: string }> = {
  manageForge: { label: "Manage forge", hint: "Edit name, description, icon and banner. Implies channels + roles." },
  manageChannels: { label: "Manage channels", hint: "Create, rename, reorder and delete channels." },
  manageRoles: { label: "Manage roles", hint: "Create roles below their own and assign them to members." },
  kickUsers: { label: "Kick members", hint: "Remove lower-ranked members from the forge." },
  banUsers: { label: "Ban members", hint: "Ban and unban lower-ranked members." },
  moderateChat: { label: "Moderate chat", hint: "Edit and delete other members' messages." },
  streamAccess: { label: "Stream access", hint: "Go live and share screen in voice channels." },
};

const inputClass =
  "h-10 w-full rounded-[14px] border border-slate-700/70 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500";
const textareaClass =
  "min-h-[84px] w-full rounded-[14px] border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500";
const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-500/50 bg-rose-950/40 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/70 text-slate-300 transition hover:border-amber-500/40 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40";

function errorText(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function channelIcon(type: Channel["type"]) {
  if (type === "VOICE") return <Volume2 className="h-3.5 w-3.5" />;
  if (type === "STAGE") return <Radio className="h-3.5 w-3.5" />;
  if (type === "ANNOUNCEMENT") return <Megaphone className="h-3.5 w-3.5" />;
  return <Hash className="h-3.5 w-3.5" />;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NF";
}

export function ForgeSettingsPanel({
  forgeId,
  open,
  onClose,
  onForgeGone,
}: {
  forgeId: string;
  open: boolean;
  onClose: () => void;
  onForgeGone: (forgeId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setNotice(null);
      setTab("overview");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const forgeQuery = useQuery({
    queryKey: ["forge", forgeId, accessToken],
    queryFn: () => getForge(accessToken!, forgeId),
    enabled: Boolean(accessToken && forgeId && open),
  });

  const accessQuery = useQuery({
    queryKey: ["forge-permissions", forgeId, accessToken],
    queryFn: () => getForgePermissions(accessToken!, forgeId),
    enabled: Boolean(accessToken && forgeId && open),
  });

  const access = accessQuery.data;
  const forge = forgeQuery.data?.forge;
  const can = (key: ForgePermissionKey) => Boolean(access?.isOwner || access?.permissions[key]);

  const invalidateForge = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["forge", forgeId, accessToken] }),
      queryClient.invalidateQueries({ queryKey: ["forges", accessToken] }),
      queryClient.invalidateQueries({ queryKey: ["home-forges", accessToken] }),
    ]);
  };

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [
      { id: "overview", label: "Overview" },
      { id: "channels", label: "Channels" },
    ];
    if (can("manageRoles")) list.push({ id: "roles", label: "Roles" });
    list.push({ id: "members", label: "Members" });
    if (can("banUsers")) list.push({ id: "bans", label: "Bans" });
    list.push({ id: "danger", label: access?.isOwner ? "Delete" : "Leave" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="nexus-panel-strong relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-slate-700/70 bg-slate-950/95 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Forge settings</p>
            <h2 className="truncate text-lg font-semibold text-slate-50">{forge?.name ?? "Loading forge..."}</h2>
            {access ? (
              <p className="text-[11px] text-slate-400">
                {access.isOwner ? "You own this forge." : `Your top role position: ${access.topPosition < 0 ? "none" : access.topPosition}`}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} title="Close" className={iconBtn}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-slate-800/80 px-3 py-2">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setTab(entry.id);
                setNotice(null);
              }}
              className={
                tab === entry.id
                  ? "rounded-full border border-amber-500/45 bg-amber-950/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100"
                  : "rounded-full border border-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:border-slate-700 hover:text-slate-100"
              }
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {notice ? (
          <div
            className={
              notice.tone === "ok"
                ? "mx-5 mt-3 rounded-[12px] border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100"
                : "mx-5 mt-3 rounded-[12px] border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100"
            }
          >
            {notice.text}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!forge || !access ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading forge data...
            </div>
          ) : tab === "overview" ? (
            <OverviewTab forge={forge} editable={can("manageForge")} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "channels" ? (
            <ChannelsTab forge={forge} editable={can("manageChannels")} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "roles" ? (
            <RolesTab forge={forge} access={access} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "members" ? (
            <MembersTab forge={forge} access={access} selfId={user?.id ?? ""} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "bans" ? (
            <BansTab forgeId={forgeId} setNotice={setNotice} invalidate={invalidateForge} />
          ) : (
            <DangerTab
              forge={forge}
              isOwner={access.isOwner}
              setNotice={setNotice}
              onDone={async () => {
                await invalidateForge();
                onForgeGone(forgeId);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type NoticeSetter = (notice: { tone: "ok" | "error"; text: string } | null) => void;

function useTokens() {
  const { accessToken, csrfToken } = useAuthStore();
  return { accessToken: accessToken ?? "", csrfToken: csrfToken ?? "" };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({
  forge,
  editable,
  setNotice,
  invalidate,
}: {
  forge: ForgeDetail;
  editable: boolean;
  setNotice: NoticeSetter;
  invalidate: () => Promise<void>;
}) {
  const { accessToken, csrfToken } = useTokens();
  const [name, setName] = useState(forge.name);
  const [description, setDescription] = useState(forge.description ?? "");
  const [icon, setIcon] = useState(forge.icon ?? "");
  const [banner, setBanner] = useState(forge.banner ?? "");

  useEffect(() => {
    setName(forge.name);
    setDescription(forge.description ?? "");
    setIcon(forge.icon ?? "");
    setBanner(forge.banner ?? "");
  }, [forge.id, forge.name, forge.description, forge.icon, forge.banner]);

  const dirty =
    name.trim() !== forge.name ||
    description.trim() !== (forge.description ?? "") ||
    icon.trim() !== (forge.icon ?? "") ||
    banner.trim() !== (forge.banner ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateForge(accessToken, csrfToken, forge.id, {
        name: name.trim() !== forge.name ? name.trim() : undefined,
        description: description.trim() !== (forge.description ?? "") ? description.trim() || null : undefined,
        icon: icon.trim() !== (forge.icon ?? "") ? icon.trim() || null : undefined,
        banner: banner.trim() !== (forge.banner ?? "") ? banner.trim() || null : undefined,
      }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Forge settings saved." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="space-y-3">
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Name</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} disabled={!editable} maxLength={80} />
        </label>
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Description</span>
          <textarea className={textareaClass} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!editable} maxLength={300} placeholder="What is this forge about?" />
        </label>
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Icon URL</span>
          <input className={inputClass} value={icon} onChange={(event) => setIcon(event.target.value)} disabled={!editable} placeholder="https://..." />
        </label>
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Banner URL</span>
          <input className={inputClass} value={banner} onChange={(event) => setBanner(event.target.value)} disabled={!editable} placeholder="https://..." />
        </label>
        {editable ? (
          <button type="button" className={primaryBtn} disabled={!dirty || mutation.isPending || name.trim().length < 2} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save changes
          </button>
        ) : (
          <p className="text-[11px] text-slate-500">You need the Manage forge permission to edit these fields.</p>
        )}
      </div>
      <aside className="space-y-3 rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          {icon.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon.trim()} alt="" className="h-12 w-12 rounded-full border border-slate-700 object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-amber-100">{initials(name || forge.name)}</div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">{name || forge.name}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">/invite/{forge.inviteCode}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Members</dt><dd className="text-slate-100">{forge.members.length}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Channels</dt><dd className="text-slate-100">{forge.channels.length}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Roles</dt><dd className="text-slate-100">{forge.roles.length}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Created</dt><dd className="text-slate-100">{new Date(forge.createdAt).toLocaleDateString()}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

function ChannelsTab({
  forge,
  editable,
  setNotice,
  invalidate,
}: {
  forge: ForgeDetail;
  editable: boolean;
  setNotice: NoticeSetter;
  invalidate: () => Promise<void>;
}) {
  const { accessToken, csrfToken } = useTokens();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Channel["type"]>("TEXT");
  const [newTopic, setNewTopic] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = useMemo(() => [...forge.channels].sort((a, b) => a.position - b.position), [forge.channels]);

  const createMutation = useMutation({
    mutationFn: () => createForgeChannel(accessToken, csrfToken, forge.id, { name: newName.trim(), type: newType, topic: newTopic.trim() || undefined }),
    onSuccess: async (result) => {
      setNewName("");
      setNewTopic("");
      setNotice({ tone: "ok", text: `Channel ${result.channel.name} created.` });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { channelId: string; name?: string; topic?: string | null; position?: number }) =>
      updateForgeChannel(accessToken, csrfToken, forge.id, input.channelId, { name: input.name, topic: input.topic, position: input.position }),
    onSuccess: async () => {
      setEditingId(null);
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (channelId: string) => deleteForgeChannel(accessToken, csrfToken, forge.id, channelId),
    onSuccess: async () => {
      setConfirmDeleteId(null);
      setNotice({ tone: "ok", text: "Channel deleted." });
      await invalidate();
    },
    onError: (error) => {
      setConfirmDeleteId(null);
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = sorted[index + direction];
    const current = sorted[index];
    if (!target || !current) return;
    // swap positions
    updateMutation.mutate({ channelId: current.id, position: target.position });
    updateMutation.mutate({ channelId: target.id, position: current.position });
  };

  return (
    <div className="space-y-4">
      {editable ? (
        <div className="rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">New channel</p>
          <div className="grid gap-2 md:grid-cols-[1fr_150px_1fr_auto]">
            <input className={inputClass} placeholder="channel-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={64} />
            <select className={inputClass} value={newType} onChange={(event) => setNewType(event.target.value as Channel["type"])}>
              <option value="TEXT">Text</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="VOICE">Voice</option>
              <option value="STAGE">Stage</option>
            </select>
            <input className={inputClass} placeholder="Topic (optional)" value={newTopic} onChange={(event) => setNewTopic(event.target.value)} maxLength={240} />
            <button type="button" className={primaryBtn} disabled={!newName.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">You need the Manage channels permission to change channels.</p>
      )}

      <ul className="space-y-1.5">
        {sorted.map((channel, index) => (
          <li key={channel.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-slate-800/80 bg-slate-900/60 px-3 py-2">
            <span className="text-amber-300/80">{channelIcon(channel.type)}</span>
            {editingId === channel.id ? (
              <>
                <input className={`${inputClass} md:max-w-[220px]`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={64} />
                <input className={`${inputClass} md:flex-1`} value={editTopic} onChange={(event) => setEditTopic(event.target.value)} placeholder="Topic" maxLength={240} />
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={!editName.trim() || updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      channelId: channel.id,
                      name: editName.trim() !== channel.name ? editName.trim() : undefined,
                      topic: editTopic.trim() !== (channel.topic ?? "") ? editTopic.trim() || null : undefined,
                    })
                  }
                >
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
                <button type="button" className={ghostBtn} onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100">{channel.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{channel.topic || `${channel.type.toLowerCase()} channel`}</p>
                </div>
                {editable ? (
                  <div className="flex items-center gap-1">
                    <button type="button" className={iconBtn} title="Move up" disabled={index === 0 || updateMutation.isPending} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className={iconBtn} title="Move down" disabled={index === sorted.length - 1 || updateMutation.isPending} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button
                      type="button"
                      className={iconBtn}
                      title="Edit"
                      onClick={() => {
                        setEditingId(channel.id);
                        setEditName(channel.name);
                        setEditTopic(channel.topic ?? "");
                        setConfirmDeleteId(null);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === channel.id ? (
                      <button type="button" className={dangerBtn} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(channel.id)}>
                        {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
                      </button>
                    ) : (
                      <button type="button" className={iconBtn} title="Delete" onClick={() => setConfirmDeleteId(channel.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function normalizePerms(raw: ForgeRole["permissions"]): ForgePermissionSet {
  const result = {} as ForgePermissionSet;
  for (const key of forgePermissionKeys) result[key] = Boolean(raw?.[key]);
  return result;
}

function RolesTab({
  forge,
  access,
  setNotice,
  invalidate,
}: {
  forge: ForgeDetail;
  access: { isOwner: boolean; topPosition: number; permissions: ForgePermissionSet };
  setNotice: NoticeSetter;
  invalidate: () => Promise<void>;
}) {
  const { accessToken, csrfToken } = useTokens();
  const sorted = useMemo(() => [...forge.roles].sort((a, b) => b.position - a.position), [forge.roles]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("#94a3b8");
  const [draftPosition, setDraftPosition] = useState(0);
  const [draftPerms, setDraftPerms] = useState<ForgePermissionSet>(normalizePerms(null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = sorted.find((role) => role.id === selectedId) ?? null;
  const isNew = selectedId === "new";

  const canTouch = (role: ForgeRole) => {
    if (role.position >= 100 || role.name.trim().toLowerCase() === "owner") return false;
    if (access.isOwner) return true;
    return role.position < access.topPosition;
  };

  const memberCount = (roleId: string) => forge.members.filter((member) => member.roleLinks.some((link) => link.roleId === roleId)).length;

  const startNew = () => {
    setSelectedId("new");
    setDraftName("");
    setDraftColor("#94a3b8");
    setDraftPosition(Math.max(0, Math.min(99, access.topPosition - 1)));
    setDraftPerms(normalizePerms(null));
    setConfirmDelete(false);
  };

  const selectRole = (role: ForgeRole) => {
    setSelectedId(role.id);
    setDraftName(role.name);
    setDraftColor(role.color);
    setDraftPosition(role.position);
    setDraftPerms(normalizePerms(role.permissions));
    setConfirmDelete(false);
  };

  const createMutation = useMutation({
    mutationFn: () => createForgeRole(accessToken, csrfToken, forge.id, { name: draftName.trim(), color: draftColor, permissions: draftPerms, position: draftPosition }),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `Role ${result.role.name} created.` });
      await invalidate();
      setSelectedId(result.role.id);
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateForgeRole(accessToken, csrfToken, forge.id, selected!.id, { name: draftName.trim(), color: draftColor, permissions: draftPerms, position: draftPosition }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Role saved." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteForgeRole(accessToken, csrfToken, forge.id, selected!.id),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Role deleted." });
      setSelectedId(null);
      setConfirmDelete(false);
      await invalidate();
    },
    onError: (error) => {
      setConfirmDelete(false);
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  const editable = isNew || (selected ? canTouch(selected) : false);
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <button type="button" className={`${primaryBtn} w-full justify-center`} onClick={startNew}>
          <Plus className="h-3.5 w-3.5" /> New role
        </button>
        <ul className="space-y-1">
          {sorted.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => selectRole(role)}
                className={
                  selectedId === role.id
                    ? "flex w-full items-center gap-2 rounded-[12px] border border-amber-500/45 bg-amber-950/40 px-3 py-2 text-left text-sm text-amber-100"
                    : "flex w-full items-center gap-2 rounded-[12px] border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-slate-600"
                }
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                <span className="min-w-0 flex-1 truncate">{role.name}</span>
                <span className="text-[10px] text-slate-500">{memberCount(role.id)} · p{role.position}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-4">
        {!selectedId ? (
          <p className="text-sm text-slate-400">Select a role to edit it, or create a new one. Roles above your own highest role are read-only.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_120px_120px]">
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Role name</span>
                <input className={inputClass} value={draftName} onChange={(event) => setDraftName(event.target.value)} disabled={!editable} maxLength={40} />
              </label>
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Color</span>
                <div className="flex items-center gap-2">
                  <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} disabled={!editable} className="h-10 w-12 cursor-pointer rounded-[10px] border border-slate-700/70 bg-slate-900/80 p-1" />
                  <input className={inputClass} value={draftColor} onChange={(event) => setDraftColor(event.target.value)} disabled={!editable} maxLength={7} />
                </div>
              </label>
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Position</span>
                <input
                  type="number"
                  className={inputClass}
                  value={draftPosition}
                  min={0}
                  max={access.isOwner ? 99 : Math.max(0, access.topPosition - 1)}
                  onChange={(event) => setDraftPosition(Number(event.target.value) || 0)}
                  disabled={!editable}
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {forgePermissionKeys.map((key) => {
                  const holdable = access.isOwner || access.permissions[key];
                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-2 rounded-[12px] border px-3 py-2 text-xs ${draftPerms[key] ? "border-amber-500/40 bg-amber-950/30" : "border-slate-800/80 bg-slate-950/40"} ${!editable || !holdable ? "opacity-60" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={draftPerms[key]}
                        disabled={!editable || !holdable}
                        onChange={(event) => setDraftPerms((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      <span>
                        <span className="block font-semibold text-slate-100">{permissionLabels[key].label}</span>
                        <span className="block text-[11px] text-slate-400">{permissionLabels[key].hint}{!holdable ? " (you do not hold this)" : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {editable ? (
              <div className="flex flex-wrap items-center gap-2">
                {isNew ? (
                  <button type="button" className={primaryBtn} disabled={!draftName.trim() || busy} onClick={() => createMutation.mutate()}>
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create role
                  </button>
                ) : (
                  <>
                    <button type="button" className={primaryBtn} disabled={!draftName.trim() || busy} onClick={() => updateMutation.mutate()}>
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save role
                    </button>
                    {confirmDelete ? (
                      <button type="button" className={dangerBtn} disabled={busy} onClick={() => deleteMutation.mutate()}>
                        <Trash2 className="h-3.5 w-3.5" /> Confirm delete ({memberCount(selected!.id)} members lose it)
                      </button>
                    ) : (
                      <button type="button" className={ghostBtn} disabled={busy} onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete role
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                {selected && (selected.position >= 100 || selected.name.toLowerCase() === "owner")
                  ? "The Owner role is protected and cannot be changed."
                  : "This role sits at or above your own highest role, so you cannot change it."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function MembersTab({
  forge,
  access,
  selfId,
  setNotice,
  invalidate,
}: {
  forge: ForgeDetail;
  access: { isOwner: boolean; topPosition: number; permissions: ForgePermissionSet };
  selfId: string;
  setNotice: NoticeSetter;
  invalidate: () => Promise<void>;
}) {
  const { accessToken, csrfToken } = useTokens();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [banReason, setBanReason] = useState("");
  const [confirm, setConfirm] = useState<{ userId: string; action: "kick" | "ban" } | null>(null);

  const roleById = useMemo(() => new Map(forge.roles.map((role) => [role.id, role] as const)), [forge.roles]);

  const rankOf = (member: ForgeMemberEntry) => {
    if (member.userId === forge.ownerId) return 100;
    let top = -1;
    for (const link of member.roleLinks) {
      const role = roleById.get(link.roleId);
      if (role && role.position > top) top = role.position;
    }
    return top;
  };

  const outranks = (member: ForgeMemberEntry) => {
    if (member.userId === forge.ownerId) return false;
    if (access.isOwner) return true;
    return access.topPosition > rankOf(member);
  };

  const can = (key: ForgePermissionKey) => access.isOwner || access.permissions[key];
  const assignable = (role: ForgeRole) => {
    if (role.position >= 100 || role.name.trim().toLowerCase() === "owner") return false;
    if (access.isOwner) return true;
    return can("manageRoles") && role.position < access.topPosition;
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = [...forge.members].sort((a, b) => rankOf(b) - rankOf(a) || a.user.username.localeCompare(b.user.username));
    if (!query) return list;
    return list.filter((member) => member.user.username.toLowerCase().includes(query) || (member.nickname ?? "").toLowerCase().includes(query));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forge.members, search, roleById]);

  const rolesMutation = useMutation({
    mutationFn: (input: { userId: string; roleIds: string[] }) => setForgeMemberRoles(accessToken, csrfToken, forge.id, input.userId, input.roleIds),
    onSuccess: async () => invalidate(),
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const nicknameMutation = useMutation({
    mutationFn: (input: { userId: string; nickname: string | null }) => updateForgeMemberNickname(accessToken, csrfToken, forge.id, input.userId, input.nickname),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Nickname updated." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const kickMutation = useMutation({
    mutationFn: (userId: string) => kickForgeMember(accessToken, csrfToken, forge.id, userId),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Member kicked." });
      setConfirm(null);
      setExpandedId(null);
      await invalidate();
    },
    onError: (error) => {
      setConfirm(null);
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  const banMutation = useMutation({
    mutationFn: (input: { userId: string; reason?: string }) => banForgeUser(accessToken, csrfToken, forge.id, input),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Member banned." });
      setConfirm(null);
      setExpandedId(null);
      setBanReason("");
      await invalidate();
    },
    onError: (error) => {
      setConfirm(null);
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  const toggleRole = (member: ForgeMemberEntry, roleId: string) => {
    const current = new Set(member.roleLinks.map((link) => link.roleId));
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    rolesMutation.mutate({ userId: member.userId, roleIds: [...current] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} md:max-w-xs`} placeholder="Search members" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span className="rounded-full border border-slate-700/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">{forge.members.length} members</span>
      </div>

      <ul className="space-y-1.5">
        {filtered.map((member) => {
          const isSelf = member.userId === selfId;
          const isOwner = member.userId === forge.ownerId;
          const expanded = expandedId === member.userId;
          const memberRoles = member.roleLinks.map((link) => roleById.get(link.roleId)).filter((role): role is ForgeRole => Boolean(role)).sort((a, b) => b.position - a.position);
          const topRole = memberRoles[0];
          const canKick = !isSelf && can("kickUsers") && outranks(member);
          const canBan = !isSelf && can("banUsers") && outranks(member);
          const canNick = isSelf || (can("manageRoles") && outranks(member));
          const canRoles = can("manageRoles") && forge.roles.some(assignable);

          return (
            <li key={member.id} className="rounded-[14px] border border-slate-800/80 bg-slate-900/60">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
                onClick={() => {
                  setExpandedId(expanded ? null : member.userId);
                  setNicknameDraft(member.nickname ?? "");
                  setConfirm(null);
                }}
              >
                {member.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.user.avatar} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-amber-100">{initials(member.user.username)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold" style={{ color: topRole?.color ?? "#e2e8f0" }}>
                      {member.nickname || member.user.username}
                    </span>
                    {member.nickname ? <span className="truncate text-[11px] text-slate-500">@{member.user.username}</span> : null}
                    {isOwner ? <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-1.5 text-[9px] uppercase tracking-[0.16em] text-amber-100">Owner</span> : null}
                    {isSelf ? <span className="rounded-full border border-slate-600 px-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-300">You</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                    <span className={member.user.status === "ONLINE" ? "text-emerald-300" : member.user.status === "IDLE" ? "text-amber-300" : member.user.status === "DND" ? "text-rose-300" : ""}>{member.user.status.toLowerCase()}</span>
                    <span>· joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                    {memberRoles.map((role) => (
                      <span key={role.id} className="rounded-full border px-1.5" style={{ borderColor: `${role.color}66`, color: role.color }}>{role.name}</span>
                    ))}
                  </span>
                </span>
              </button>

              {expanded ? (
                <div className="space-y-3 border-t border-slate-800/80 px-3 py-3">
                  {canRoles && !isOwner ? (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...forge.roles].sort((a, b) => b.position - a.position).map((role) => {
                          const has = member.roleLinks.some((link) => link.roleId === role.id);
                          const allowed = assignable(role);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              disabled={!allowed || rolesMutation.isPending}
                              onClick={() => toggleRole(member, role.id)}
                              className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 ${has ? "bg-slate-800/80" : "bg-transparent"}`}
                              style={{ borderColor: has ? role.color : "#334155", color: has ? role.color : "#94a3b8" }}
                              title={allowed ? (has ? "Remove role" : "Add role") : "Cannot assign this role"}
                            >
                              {has ? "✓ " : ""}{role.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {canNick ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block flex-1 text-xs text-slate-300">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Nickname</span>
                        <input className={inputClass} value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} maxLength={32} placeholder={member.user.username} />
                      </label>
                      <button
                        type="button"
                        className={ghostBtn}
                        disabled={nicknameMutation.isPending || nicknameDraft.trim() === (member.nickname ?? "")}
                        onClick={() => nicknameMutation.mutate({ userId: member.userId, nickname: nicknameDraft.trim() || null })}
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                    </div>
                  ) : null}

                  {canKick || canBan ? (
                    <div className="space-y-2">
                      {canBan ? (
                        <input className={inputClass} placeholder="Ban reason (optional)" value={banReason} onChange={(event) => setBanReason(event.target.value)} maxLength={300} />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {canKick ? (
                          confirm?.userId === member.userId && confirm.action === "kick" ? (
                            <button type="button" className={dangerBtn} disabled={kickMutation.isPending} onClick={() => kickMutation.mutate(member.userId)}>
                              {kickMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Confirm kick
                            </button>
                          ) : (
                            <button type="button" className={ghostBtn} onClick={() => setConfirm({ userId: member.userId, action: "kick" })}>
                              <LogOut className="h-3.5 w-3.5" /> Kick
                            </button>
                          )
                        ) : null}
                        {canBan ? (
                          confirm?.userId === member.userId && confirm.action === "ban" ? (
                            <button type="button" className={dangerBtn} disabled={banMutation.isPending} onClick={() => banMutation.mutate({ userId: member.userId, reason: banReason.trim() || undefined })}>
                              {banMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Confirm ban
                            </button>
                          ) : (
                            <button type="button" className={ghostBtn} onClick={() => setConfirm({ userId: member.userId, action: "ban" })}>
                              <Ban className="h-3.5 w-3.5" /> Ban
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {!canRoles && !canNick && !canKick && !canBan ? (
                    <p className="text-[11px] text-slate-500">{isOwner ? "The owner cannot be moderated." : "You do not outrank this member or lack the permissions to act on them."}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

function BansTab({ forgeId, setNotice, invalidate }: { forgeId: string; setNotice: NoticeSetter; invalidate: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useTokens();
  const bansQuery = useQuery({
    queryKey: ["forge-bans", forgeId, accessToken],
    queryFn: () => listForgeBans(accessToken, forgeId),
    enabled: Boolean(accessToken && forgeId),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => unbanForgeUser(accessToken, csrfToken, forgeId, userId),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Ban lifted." });
      await queryClient.invalidateQueries({ queryKey: ["forge-bans", forgeId, accessToken] });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const bans = bansQuery.data?.bans ?? [];

  return (
    <div className="space-y-2">
      {bansQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading bans...</p>
      ) : bans.length === 0 ? (
        <p className="text-sm text-slate-400">No banned users. Ban members from the Members tab.</p>
      ) : (
        <ul className="space-y-1.5">
          {bans.map((ban) => (
            <li key={ban.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-slate-800/80 bg-slate-900/60 px-3 py-2">
              {ban.user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ban.user.avatar} alt="" className="h-8 w-8 rounded-full border border-slate-700 object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-rose-100">{initials(ban.user.username)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{ban.user.username}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {ban.reason || "No reason given"} · by {ban.bannedBy.username} · {new Date(ban.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button type="button" className={ghostBtn} disabled={unbanMutation.isPending} onClick={() => unbanMutation.mutate(ban.userId)}>
                <ShieldAlert className="h-3.5 w-3.5" /> Unban
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerTab({
  forge,
  isOwner,
  setNotice,
  onDone,
}: {
  forge: ForgeDetail;
  isOwner: boolean;
  setNotice: NoticeSetter;
  onDone: () => Promise<void>;
}) {
  const { accessToken, csrfToken } = useTokens();
  const [confirmText, setConfirmText] = useState("");

  const leaveMutation = useMutation({
    mutationFn: () => leaveForge(accessToken, csrfToken, forge.id),
    onSuccess: onDone,
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteForge(accessToken, csrfToken, forge.id),
    onSuccess: onDone,
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  if (isOwner) {
    return (
      <div className="space-y-3 rounded-[14px] border border-rose-500/30 bg-rose-950/20 p-4">
        <h3 className="text-sm font-semibold text-rose-100">Delete this forge</h3>
        <p className="text-xs text-rose-200/80">
          This permanently deletes <strong>{forge.name}</strong>, its {forge.channels.length} channels, every message, and removes all {forge.members.length} members. There is no undo.
        </p>
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Type the forge name to confirm</span>
          <input className={inputClass} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={forge.name} />
        </label>
        <button type="button" className={dangerBtn} disabled={confirmText.trim() !== forge.name || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
          {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete forge permanently
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-rose-500/30 bg-rose-950/20 p-4">
      <h3 className="text-sm font-semibold text-rose-100">Leave this forge</h3>
      <p className="text-xs text-rose-200/80">You will lose your roles and nickname in <strong>{forge.name}</strong>. You can rejoin later with an invite link unless you are banned.</p>
      <button type="button" className={dangerBtn} disabled={leaveMutation.isPending} onClick={() => leaveMutation.mutate()}>
        {leaveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Leave forge
      </button>
    </div>
  );
}
