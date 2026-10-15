"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { X, Hash, Volume2, Megaphone, Radio, Plus, Trash2, Pencil, Check, ShieldAlert, Ban, LogOut, Loader2, ArrowUp, ArrowDown, Lock, Copy, Folder, Clock, Crown, MessagesSquare } from "lucide-react";
import {
  banForgeUser,
  updateForgeInviteCode,
  createForgeChannel,
  createForgeInvite,
  getForgeAuditLog,
  handleReport,
  listForgeInvites,
  listForgeReports,
  revokeForgeInvite,
  timeoutForgeMember,
  transferForgeOwnership,
  type ForgeAuditEntry,
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
import { AutoModTab } from "@/components/chat/automod-tab";
import { EmojiTab } from "@/components/chat/emoji-tab";
import { StickersTab } from "@/components/chat/stickers-tab";
import { SoundsTab } from "@/components/chat/sounds-tab";
import { BotsTab } from "@/components/chat/bots-tab";
import { WebhooksTab } from "@/components/chat/webhooks-tab";

type Tab = "overview" | "channels" | "roles" | "members" | "invites" | "reports" | "automod" | "emoji" | "stickers" | "sounds" | "webhooks" | "bots" | "bans" | "audit" | "danger";

const permissionLabels: Record<ForgePermissionKey, { label: string; hint: string }> = {
  manageForge: { label: "Manage forge", hint: "Edit name, description, icon and banner. Implies channels + roles." },
  manageChannels: { label: "Manage channels", hint: "Create, rename, reorder and delete channels." },
  manageRoles: { label: "Manage roles", hint: "Create roles below their own and assign them to members." },
  kickUsers: { label: "Kick members", hint: "Remove lower-ranked members from the forge." },
  banUsers: { label: "Ban members", hint: "Ban and unban lower-ranked members." },
  moderateChat: { label: "Moderate chat", hint: "Delete lower-ranked members' messages, pin messages, time members out, skip slowmode." },
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
  if (type === "CATEGORY") return <Folder className="h-3.5 w-3.5" />;
  if (type === "FORUM") return <MessagesSquare className="h-3.5 w-3.5" />;
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
  initialTab,
}: {
  forgeId: string;
  open: boolean;
  onClose: () => void;
  onForgeGone: (forgeId: string) => void;
  initialTab?: Tab;
}) {
  const queryClient = useQueryClient();
  const { accessToken, user } = useAuthStore();
  const [tab, setTab] = useState<Tab>(initialTab ?? "overview");
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);
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
    list.push({ id: "invites", label: "Invites" });
    if (can("moderateChat")) list.push({ id: "reports", label: "Reports" });
    if (can("manageForge")) list.push({ id: "automod", label: "AutoMod" });
    if (can("manageForge")) list.push({ id: "emoji", label: "Emoji" });
    if (can("manageForge")) list.push({ id: "stickers", label: "Stickers" });
    if (can("manageForge")) list.push({ id: "sounds", label: "Soundboard" });
    if (can("manageChannels")) list.push({ id: "webhooks", label: "Webhooks" });
    if (access?.isOwner) list.push({ id: "bots", label: "Bots" });
    if (can("banUsers")) list.push({ id: "bans", label: "Bans" });
    if (can("manageForge")) list.push({ id: "audit", label: "Audit log" });
    list.push({ id: "danger", label: access?.isOwner ? "Delete" : "Leave" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Server settings" className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
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
          ) : tab === "invites" ? (
            <InvitesTab forge={forge} isOwner={access.isOwner} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "reports" ? (
            <ReportsTab forgeId={forgeId} setNotice={setNotice} />
          ) : tab === "automod" ? (
            <AutoModTab forge={forge} setNotice={setNotice} />
          ) : tab === "emoji" ? (
            <EmojiTab forge={forge} setNotice={setNotice} />
          ) : tab === "stickers" ? (
            <StickersTab forge={forge} setNotice={setNotice} />
          ) : tab === "sounds" ? (
            <SoundsTab forge={forge} setNotice={setNotice} />
          ) : tab === "webhooks" ? (
            <WebhooksTab forge={forge} setNotice={setNotice} />
          ) : tab === "bots" ? (
            <BotsTab forge={forge} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "bans" ? (
            <BansTab forgeId={forgeId} setNotice={setNotice} invalidate={invalidateForge} />
          ) : tab === "audit" ? (
            <AuditLogTab forgeId={forgeId} />
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

  // Public servers are listed on Discover, where anyone can search for them and join without an invite code.
  const visibility = useMutation({
    mutationFn: (next: boolean) => updateForge(accessToken, csrfToken, forge.id, { isPublic: next }),
    onSuccess: async (_result, next) => {
      setNotice({ tone: "ok", text: next ? "Your server is public. It now appears on Discover." : "Your server is private again." });
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
        <div className="rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
          <p className="text-sm font-semibold text-slate-100">{forge.isPublic ? "Public server" : "Private server"}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {forge.isPublic
              ? "Listed on Discover. Anyone can search for it by name and join with one click, no invite code needed."
              : "Only people with the invite link can join. Make it public to list it on Discover, so people can search for it and join directly."}
          </p>
          <button type="button" className={`${primaryBtn} mt-3`} disabled={!editable || visibility.isPending} onClick={() => visibility.mutate(!forge.isPublic)}>
            {visibility.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {forge.isPublic ? "Make private" : "Make public"}
          </button>
        </div>
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

const slowmodeChoices: Array<{ value: number; label: string }> = [
  { value: 0, label: "Off" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 900, label: "15m" },
  { value: 3600, label: "1h" },
  { value: 21600, label: "6h" },
];

function slowmodeLabel(seconds: number) {
  return slowmodeChoices.find((choice) => choice.value === seconds)?.label ?? `${seconds}s`;
}

type ChannelDraft = {
  forumTags?: string;
  name: string;
  topic: string;
  parentId: string;
  slowmodeSeconds: number;
  isPrivate: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
};

function draftFrom(channel: Channel): ChannelDraft {
  return {
    name: channel.name,
    topic: channel.topic ?? "",
    parentId: channel.parentId ?? "",
    slowmodeSeconds: channel.slowmodeSeconds ?? 0,
    isPrivate: Boolean(channel.isPrivate),
    allowedRoleIds: channel.allowedRoleIds ?? [],
    allowedUserIds: channel.allowedUserIds ?? [],
    forumTags: (channel.forumTags ?? []).join(", "),
  };
}

/** Category, slowmode and private-access fields, shared by "new channel" and "edit channel". */
function ChannelAccessFields({
  forge,
  type,
  draft,
  setDraft,
}: {
  forge: ForgeDetail;
  type: Channel["type"];
  draft: ChannelDraft;
  setDraft: (update: (current: ChannelDraft) => ChannelDraft) => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const categories = forge.channels.filter((channel) => channel.type === "CATEGORY");
  const isText = type === "TEXT" || type === "ANNOUNCEMENT" || type === "FORUM";
  const roles = [...forge.roles].filter((role) => role.position < 100).sort((a, b) => b.position - a.position);
  const memberMatches = memberQuery.trim()
    ? forge.members
        .filter((member) => member.userId !== forge.ownerId && !draft.allowedUserIds.includes(member.userId))
        .filter((member) => `${member.user.username} ${member.nickname ?? ""}`.toLowerCase().includes(memberQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {type !== "CATEGORY" ? (
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Category</span>
            <select className={inputClass} value={draft.parentId} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value }))}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {isText ? (
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Slowmode</span>
            <select className={inputClass} value={draft.slowmodeSeconds} onChange={(event) => setDraft((current) => ({ ...current, slowmodeSeconds: Number(event.target.value) }))}>
              {slowmodeChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {type === "FORUM" ? (
        <label className="block text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Post tags (comma separated)</span>
          <input className={inputClass} value={draft.forumTags ?? ""} onChange={(event) => setDraft((current) => ({ ...current, forumTags: event.target.value }))} placeholder="question, guide, lfg, bug" />
        </label>
      ) : null}
      {type !== "CATEGORY" ? (
        <div className="rounded-[12px] border border-slate-800/80 bg-slate-950/40 p-3">
          <label className="flex items-start gap-2 text-xs text-slate-200">
            <input type="checkbox" className="mt-0.5" checked={draft.isPrivate} onChange={(event) => setDraft((current) => ({ ...current, isPrivate: event.target.checked }))} />
            <span>
              <span className="flex items-center gap-1 font-semibold text-slate-100"><Lock className="h-3 w-3" /> Private channel</span>
              <span className="block text-[11px] text-slate-400">Only the roles and members you pick can see it. The owner and anyone who can manage channels always can.</span>
            </span>
          </label>
          {draft.isPrivate ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Roles with access</p>
                {roles.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((role) => {
                      const on = draft.allowedRoleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, allowedRoleIds: toggle(current.allowedRoleIds, role.id) }))}
                          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${on ? "bg-slate-800/80" : "bg-transparent"}`}
                          style={{ borderColor: on ? role.color : "#334155", color: on ? role.color : "#94a3b8" }}
                          aria-pressed={on}
                        >
                          {on ? "✓ " : ""}{role.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No roles yet. Create one in the Roles tab, or add members below.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Members with access</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {draft.allowedUserIds.map((userId) => {
                    const member = forge.members.find((entry) => entry.userId === userId);
                    return (
                      <span key={userId} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-100">
                        {member ? member.nickname || member.user.username : "Former member"}
                        <button
                          type="button"
                          title="Remove"
                          className="text-slate-400 hover:text-rose-200"
                          onClick={() => setDraft((current) => ({ ...current, allowedUserIds: current.allowedUserIds.filter((id) => id !== userId) }))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <input className={inputClass} placeholder="Add a member by name" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
                {memberMatches.length ? (
                  <ul className="mt-1 space-y-1">
                    {memberMatches.map((member) => (
                      <li key={member.userId}>
                        <button
                          type="button"
                          className="w-full rounded-[10px] border border-slate-800 bg-slate-900/70 px-2 py-1 text-left text-xs text-slate-200 hover:border-amber-500/40"
                          onClick={() => {
                            setDraft((current) => ({ ...current, allowedUserIds: [...current.allowedUserIds, member.userId] }));
                            setMemberQuery("");
                          }}
                        >
                          {member.nickname || member.user.username} <span className="text-slate-500">@{member.user.username}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
  const emptyDraft: ChannelDraft = { name: "", topic: "", parentId: "", slowmodeSeconds: 0, isPrivate: false, allowedRoleIds: [], allowedUserIds: [] };
  const [newType, setNewType] = useState<Channel["type"]>("TEXT");
  const [newDraft, setNewDraft] = useState<ChannelDraft>(emptyDraft);
  const [showNewOptions, setShowNewOptions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ChannelDraft>(emptyDraft);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = useMemo(() => [...forge.channels].sort((a, b) => a.position - b.position), [forge.channels]);
  // Sidebar order: uncategorised channels first, then each category followed by its channels.
  const groups = useMemo(() => {
    const categories = sorted.filter((channel) => channel.type === "CATEGORY");
    const known = new Set(categories.map((category) => category.id));
    const loose = sorted.filter((channel) => channel.type !== "CATEGORY" && (!channel.parentId || !known.has(channel.parentId)));
    return [
      { category: null as Channel | null, channels: loose },
      ...categories.map((category) => ({ category, channels: sorted.filter((channel) => channel.type !== "CATEGORY" && channel.parentId === category.id) })),
    ];
  }, [sorted]);

  const settingsPayload = (draft: ChannelDraft, type: Channel["type"]) => ({
    forumTags: type === "FORUM" ? [...new Set((draft.forumTags ?? "").split(",").map((tag) => tag.trim().slice(0, 20)).filter(Boolean))].slice(0, 20) : undefined,
    parentId: type === "CATEGORY" ? undefined : draft.parentId || null,
    slowmodeSeconds: type === "TEXT" || type === "ANNOUNCEMENT" || type === "FORUM" ? draft.slowmodeSeconds : undefined,
    isPrivate: type === "CATEGORY" ? undefined : draft.isPrivate,
    allowedRoleIds: type === "CATEGORY" ? undefined : draft.allowedRoleIds,
    allowedUserIds: type === "CATEGORY" ? undefined : draft.allowedUserIds,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createForgeChannel(accessToken, csrfToken, forge.id, {
        name: newDraft.name.trim(),
        type: newType,
        topic: newType === "CATEGORY" ? undefined : newDraft.topic.trim() || undefined,
        ...settingsPayload(newDraft, newType),
      }),
    onSuccess: async (result) => {
      setNewDraft(emptyDraft);
      setShowNewOptions(false);
      setNotice({ tone: "ok", text: `${result.channel.type === "CATEGORY" ? "Category" : "Channel"} ${result.channel.name} created.` });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { channelId: string; payload: Parameters<typeof updateForgeChannel>[4] }) =>
      updateForgeChannel(accessToken, csrfToken, forge.id, input.channelId, input.payload),
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
      setNotice({ tone: "ok", text: "Deleted." });
      await invalidate();
    },
    onError: (error) => {
      setConfirmDeleteId(null);
      setNotice({ tone: "error", text: errorText(error) });
    },
  });

  /** Swap with the neighbour in the same group (categories move among categories). */
  const move = (list: Channel[], index: number, direction: -1 | 1) => {
    const target = list[index + direction];
    const current = list[index];
    if (!target || !current) return;
    updateMutation.mutate({ channelId: current.id, payload: { position: target.position } });
    updateMutation.mutate({ channelId: target.id, payload: { position: current.position } });
  };

  const saveEdit = (channel: Channel) => {
    const payload: Parameters<typeof updateForgeChannel>[4] = { ...settingsPayload(editDraft, channel.type) };
    if (editDraft.name.trim() !== channel.name) payload.name = editDraft.name.trim();
    if (channel.type !== "CATEGORY" && editDraft.topic.trim() !== (channel.topic ?? "")) payload.topic = editDraft.topic.trim() || null;
    updateMutation.mutate({ channelId: channel.id, payload });
  };

  const categories = sorted.filter((channel) => channel.type === "CATEGORY");

  const renderRow = (channel: Channel, list: Channel[], index: number, indent: boolean) => (
    <li key={channel.id} className={`rounded-[14px] border border-slate-800/80 bg-slate-900/60 px-3 py-2 ${indent ? "ml-4" : ""}`}>
      {editingId === channel.id ? (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[220px_1fr]">
            <input className={inputClass} value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} maxLength={64} />
            {channel.type !== "CATEGORY" ? (
              <input className={inputClass} value={editDraft.topic} onChange={(event) => setEditDraft((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic" maxLength={240} />
            ) : null}
          </div>
          <ChannelAccessFields forge={forge} type={channel.type} draft={editDraft} setDraft={setEditDraft} />
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} disabled={!editDraft.name.trim() || updateMutation.isPending} onClick={() => saveEdit(channel)}>
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button type="button" className={ghostBtn} onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-amber-300/80">{channelIcon(channel.type)}</span>
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1.5 truncate text-sm ${channel.type === "CATEGORY" ? "font-semibold uppercase tracking-[0.14em] text-slate-300" : "text-slate-100"}`}>
              {channel.name}
              {channel.isPrivate ? <Lock className="h-3 w-3 shrink-0 text-amber-300/80" aria-label="Private" /> : null}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {channel.type === "CATEGORY"
                ? "category"
                : [channel.topic || `${channel.type.toLowerCase()} channel`, channel.slowmodeSeconds ? `slowmode ${slowmodeLabel(channel.slowmodeSeconds)}` : null, channel.isPrivate ? "private" : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          {editable ? (
            <div className="flex items-center gap-1">
              <button type="button" className={iconBtn} title="Move up" disabled={index === 0 || updateMutation.isPending} onClick={() => move(list, index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" className={iconBtn} title="Move down" disabled={index === list.length - 1 || updateMutation.isPending} onClick={() => move(list, index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button
                type="button"
                className={iconBtn}
                title="Edit"
                onClick={() => {
                  setEditingId(channel.id);
                  setEditDraft(draftFrom(channel));
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
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      {editable ? (
        <div className="space-y-3 rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">New channel or category</p>
          <div className="grid gap-2 md:grid-cols-[1fr_150px_1fr_auto]">
            <input
              className={inputClass}
              placeholder={newType === "CATEGORY" ? "Category name" : "channel-name"}
              value={newDraft.name}
              onChange={(event) => setNewDraft((current) => ({ ...current, name: event.target.value }))}
              maxLength={64}
            />
            <select className={inputClass} value={newType} onChange={(event) => setNewType(event.target.value as Channel["type"])}>
              <option value="TEXT">Text</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="VOICE">Voice</option>
              <option value="STAGE">Stage</option>
              <option value="FORUM">Forum</option>
              <option value="CATEGORY">Category</option>
            </select>
            {newType !== "CATEGORY" ? (
              <input className={inputClass} placeholder="Topic (optional)" value={newDraft.topic} onChange={(event) => setNewDraft((current) => ({ ...current, topic: event.target.value }))} maxLength={240} />
            ) : (
              <span className="hidden md:block" />
            )}
            <button type="button" className={primaryBtn} disabled={!newDraft.name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
            </button>
          </div>
          {newType !== "CATEGORY" ? (
            showNewOptions ? (
              <ChannelAccessFields forge={forge} type={newType} draft={newDraft} setDraft={setNewDraft} />
            ) : (
              <button type="button" className="text-[11px] text-amber-200/80 underline-offset-2 hover:underline" onClick={() => setShowNewOptions(true)}>
                Category, slowmode and private access{categories.length ? "" : " (create a category first to group channels)"}
              </button>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">You need the Manage channels permission to change channels.</p>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          if (!group.category && !group.channels.length) return null;
          const categoryIndex = group.category ? categories.findIndex((entry) => entry.id === group.category!.id) : -1;
          return (
            <ul key={group.category?.id ?? "loose"} className="space-y-1.5">
              {group.category ? renderRow(group.category, categories, categoryIndex, false) : null}
              {group.channels.map((channel, index) => renderRow(channel, group.channels, index, Boolean(group.category)))}
              {group.category && !group.channels.length ? <li className="ml-4 text-[11px] text-slate-500">Empty. Edit a channel to move it here.</li> : null}
            </ul>
          );
        })}
      </div>
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
  const [timeoutMinutes, setTimeoutMinutes] = useState(10);
  const [timeoutReason, setTimeoutReason] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const timeoutMutation = useMutation({
    mutationFn: (input: { userId: string; minutes: number | null; reason?: string }) =>
      timeoutForgeMember(accessToken, csrfToken, forge.id, input.userId, { minutes: input.minutes, reason: input.reason }),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: result.timeoutUntil ? `Timed out until ${new Date(result.timeoutUntil).toLocaleString()}.` : "Timeout removed." });
      setTimeoutReason("");
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
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
          const canTimeout = !isSelf && can("moderateChat") && outranks(member);
          const timedOutUntil = member.timeoutUntil && new Date(member.timeoutUntil).getTime() > now ? new Date(member.timeoutUntil) : null;
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
                    {timedOutUntil ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-1.5 text-[9px] uppercase tracking-[0.16em] text-rose-100" title={`Until ${timedOutUntil.toLocaleString()}`}>
                        <Clock className="h-2.5 w-2.5" /> Timed out
                      </span>
                    ) : null}
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

                  {canTimeout ? (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        Timeout{timedOutUntil ? ` · until ${timedOutUntil.toLocaleString()}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">They can still read, but can&apos;t send messages, react or join voice.</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select className={`${inputClass} sm:max-w-[160px]`} value={timeoutMinutes} onChange={(event) => setTimeoutMinutes(Number(event.target.value))} aria-label="Timeout length">
                          <option value={1}>60 seconds</option>
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={1440}>1 day</option>
                          <option value={10080}>1 week</option>
                        </select>
                        <input className={`${inputClass} sm:flex-1`} placeholder="Reason (optional)" value={timeoutReason} onChange={(event) => setTimeoutReason(event.target.value)} maxLength={300} />
                        <button
                          type="button"
                          className={ghostBtn}
                          disabled={timeoutMutation.isPending}
                          onClick={() => timeoutMutation.mutate({ userId: member.userId, minutes: timeoutMinutes, reason: timeoutReason.trim() || undefined })}
                        >
                          <Clock className="h-3.5 w-3.5" /> {timedOutUntil ? "Change" : "Time out"}
                        </button>
                        {timedOutUntil ? (
                          <button type="button" className={ghostBtn} disabled={timeoutMutation.isPending} onClick={() => timeoutMutation.mutate({ userId: member.userId, minutes: null })}>
                            Remove timeout
                          </button>
                        ) : null}
                      </div>
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

                  {!canRoles && !canNick && !canKick && !canBan && !canTimeout ? (
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
// Invites
// ---------------------------------------------------------------------------

const inviteAgeChoices = [
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 21600, label: "6 hours" },
  { value: 43200, label: "12 hours" },
  { value: 86400, label: "1 day" },
  { value: 604800, label: "7 days" },
  { value: 0, label: "Never" },
];
const inviteUseChoices = [0, 1, 5, 10, 25, 50, 100];

function timeLeft(iso: string | null) {
  if (!iso) return "never expires";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `expires in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `expires in ${hours}h`;
  return `expires in ${Math.round(hours / 24)}d`;
}

function InvitesTab({ forge, isOwner, setNotice, invalidate }: { forge: ForgeDetail; isOwner: boolean; setNotice: NoticeSetter; invalidate: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useTokens();
  const [customCode, setCustomCode] = useState<string | null>(null);
  const customMutation = useMutation({
    mutationFn: (code: string) => updateForgeInviteCode(accessToken, csrfToken, forge.id, code),
    onSuccess: async () => {
      setCustomCode(null);
      await invalidate();
      setNotice({ tone: "ok", text: "Permanent link changed. The old one no longer works." });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const [maxAgeSeconds, setMaxAgeSeconds] = useState(604800);
  const [maxUses, setMaxUses] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryKey = ["forge-invites", forge.id, accessToken];
  const invitesQuery = useQuery({ queryKey, queryFn: () => listForgeInvites(accessToken, forge.id), enabled: Boolean(accessToken) });

  const linkFor = (code: string) => (typeof window === "undefined" ? `/invite/${code}` : `${window.location.origin}/invite/${code}`);
  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      setNotice({ tone: "error", text: "Couldn't copy. Select the link and copy it by hand." });
    }
  };

  const createMutation = useMutation({
    mutationFn: () => createForgeInvite(accessToken, csrfToken, forge.id, { maxAgeSeconds, maxUses }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey });
      void copy(result.invite.id, result.invite.code);
      setNotice({ tone: "ok", text: "Invite created and copied." });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeForgeInvite(accessToken, csrfToken, forge.id, inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setNotice({ tone: "ok", text: "Invite revoked." });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const invites = invitesQuery.data?.invites ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
        <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Permanent link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[10px] border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200">{linkFor(forge.inviteCode)}</code>
          <button type="button" className={ghostBtn} onClick={() => copy("permanent", forge.inviteCode)}>
            {copiedId === "permanent" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiedId === "permanent" ? "Copied" : "Copy"}
          </button>
          {isOwner && customCode === null ? (
            <button type="button" className={ghostBtn} onClick={() => setCustomCode(forge.inviteCode)}>
              <Pencil className="h-3.5 w-3.5" /> Change
            </button>
          ) : null}
        </div>
        {isOwner && customCode !== null ? (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input
                className={inputClass}
                aria-label="Custom invite link"
                value={customCode}
                maxLength={32}
                onChange={(event) => setCustomCode(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
              />
              <button type="button" className={ghostBtn} disabled={customCode.length < 3 || customCode === forge.inviteCode || customMutation.isPending} onClick={() => customMutation.mutate(customCode)}>
                {customMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
              </button>
              <button type="button" className={ghostBtn} onClick={() => setCustomCode(null)}>Cancel</button>
            </div>
            <p className="text-[11px] text-slate-500">3-32 letters, numbers or hyphens, like my-clan. The current link stops working when you change it.</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">New invite link</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Expire after</span>
            <select className={inputClass} value={maxAgeSeconds} onChange={(event) => setMaxAgeSeconds(Number(event.target.value))}>
              {inviteAgeChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Max uses</span>
            <select className={inputClass} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))}>
              {inviteUseChoices.map((choice) => (
                <option key={choice} value={choice}>{choice === 0 ? "No limit" : `${choice} ${choice === 1 ? "use" : "uses"}`}</option>
              ))}
            </select>
          </label>
          <button type="button" className={`${primaryBtn} self-end`} disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create link
          </button>
        </div>
      </div>

      {invitesQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading invites...</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-slate-400">No active invite links{invitesQuery.data?.canManageAll ? "" : " made by you"}.</p>
      ) : (
        <ul className="space-y-1.5">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-slate-800/80 bg-slate-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-slate-100">{invite.code}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {invite.uses}{invite.maxUses ? ` / ${invite.maxUses}` : ""} uses · {timeLeft(invite.expiresAt)}{invite.creator ? ` · by ${invite.creator.username}` : ""}
                </p>
              </div>
              <button type="button" className={iconBtn} title="Copy link" onClick={() => copy(invite.id, invite.code)}>
                {copiedId === invite.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className={iconBtn} title="Revoke" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(invite.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const auditFilters = [
  { value: "", label: "All actions" },
  { value: "member", label: "Members" },
  { value: "ban", label: "Bans" },
  { value: "message", label: "Messages" },
  { value: "channel", label: "Channels" },
  { value: "role", label: "Roles" },
  { value: "invite", label: "Invites" },
  { value: "forge", label: "Forge settings" },
  { value: "automod", label: "AutoMod" },
];

const auditFieldNames: Record<string, string> = {
  name: "name",
  topic: "topic",
  position: "order",
  parentId: "category",
  slowmodeSeconds: "slowmode",
  isPrivate: "privacy",
  allowedRoleIds: "roles with access",
  allowedUserIds: "members with access",
};

function describeAudit(entry: ForgeAuditEntry): string {
  const target = entry.targetLabel ?? "something";
  const details = entry.details ?? {};
  switch (entry.action) {
    case "forge.update": return `updated forge settings (${((details.changed as string[]) ?? []).join(", ")})`;
    case "forge.transfer": return `transferred ownership to ${target}`;
    case "channel.create": return `created ${details.type === "CATEGORY" ? "category" : "channel"} ${target}`;
    case "channel.update": return `updated channel ${target} (${Object.keys(details).map((key) => auditFieldNames[key] ?? key).join(", ")})`;
    case "channel.delete": return `deleted ${details.type === "CATEGORY" ? "category" : "channel"} ${target}`;
    case "role.create": return `created role ${target}`;
    case "role.update": return `updated role ${target}`;
    case "role.delete": return `deleted role ${target}`;
    case "member.roles": {
      const added = (details.added as string[]) ?? [];
      const removed = (details.removed as string[]) ?? [];
      return `changed roles for ${target}${added.length ? ` +${added.join(", +")}` : ""}${removed.length ? ` -${removed.join(", -")}` : ""}`;
    }
    case "member.nickname": return `changed ${target}'s nickname${details.nickname ? ` to ${details.nickname}` : ""}`;
    case "member.kick": return `kicked ${target}`;
    case "member.timeout": return `timed out ${target} for ${details.minutes} min${details.reason ? ` (${details.reason})` : ""}`;
    case "member.untimeout": return `removed ${target}'s timeout`;
    case "ban.create": return `banned ${target}${details.reason ? ` (${details.reason})` : ""}`;
    case "ban.delete": return `unbanned ${target}`;
    case "invite.create": return `created invite ${target}`;
    case "invite.revoke": return `revoked invite ${target}`;
    case "message.delete": return `deleted a message by ${target}`;
    case "message.pin": return "pinned a message";
    case "message.unpin": return "unpinned a message";
    case "automod.block": return `tripped AutoMod rule "${String(details.rule ?? "")}"${details.blocked ? " (message blocked)" : ""}${details.timeoutMinutes ? `, timed out ${details.timeoutMinutes} min` : ""}`;
    case "automod.rule.create": return `created AutoMod rule ${target}`;
    case "automod.rule.update": return `updated AutoMod rule ${target}`;
    case "automod.rule.delete": return `deleted AutoMod rule ${target}`;
    case "webhook.create": return `created webhook ${target}`;
    case "webhook.update": return `updated webhook ${target}`;
    case "webhook.reset": return `made a new URL for webhook ${target}`;
    case "webhook.delete": return `deleted webhook ${target}`;
    default: return `${entry.action} ${target}`;
  }
}

function AuditLogTab({ forgeId }: { forgeId: string }) {
  const { accessToken } = useTokens();
  const [filter, setFilter] = useState("");
  const [pages, setPages] = useState<ForgeAuditEntry[][]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const firstPage = useQuery({
    queryKey: ["forge-audit", forgeId, filter, accessToken],
    queryFn: () => getForgeAuditLog(accessToken, forgeId, { action: filter || undefined }),
    enabled: Boolean(accessToken),
  });
  useEffect(() => {
    setPages([]);
    setNextBefore(firstPage.data?.nextBefore ?? null);
  }, [firstPage.data]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const result = await getForgeAuditLog(accessToken, forgeId, { action: filter || undefined, before: nextBefore });
      setPages((current) => [...current, result.entries]);
      setNextBefore(result.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  };

  const entries = [...(firstPage.data?.entries ?? []), ...pages.flat()];

  return (
    <div className="space-y-3">
      <select className={`${inputClass} sm:max-w-[220px]`} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter audit log">
        {auditFilters.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {firstPage.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading audit log...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing recorded yet. Moderation and settings changes show up here.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-[14px] border border-slate-800/80 bg-slate-900/60 px-3 py-2">
              {entry.actor.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.actor.avatar} alt="" className="h-7 w-7 rounded-full border border-slate-700 object-cover" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-amber-100">{initials(entry.actor.username)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-slate-200">
                  <span className="font-semibold text-slate-50">{entry.actor.username}</span> {describeAudit(entry)}
                </p>
                <p className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                {entry.action === "message.delete" && typeof entry.details?.excerpt === "string" ? (
                  <p className="mt-1 truncate rounded-[8px] border border-slate-800 bg-slate-950/50 px-2 py-1 text-[11px] text-slate-400">{entry.details.excerpt as string}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {nextBefore ? (
        <button type="button" className={ghostBtn} disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load older
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports (moderators)
// ---------------------------------------------------------------------------

const reportReasonLabels: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE: "Hate speech",
  SEXUAL: "Sexual content",
  VIOLENCE: "Violence",
  SELF_HARM: "Self-harm",
  SCAM: "Scam",
  OTHER: "Other",
};

function ReportsTab({ forgeId, setNotice }: { forgeId: string; setNotice: NoticeSetter }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useTokens();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "DISMISSED">("OPEN");
  const queryKey = ["forge-reports", forgeId, status, accessToken];
  const reportsQuery = useQuery({ queryKey, queryFn: () => listForgeReports(accessToken, forgeId, status), enabled: Boolean(accessToken) });

  const handleMutation = useMutation({
    mutationFn: (input: { reportId: string; status: "OPEN" | "RESOLVED" | "DISMISSED"; deleteMessage?: boolean }) =>
      handleReport(accessToken, csrfToken, input.reportId, { status: input.status, deleteMessage: input.deleteMessage }),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: result.messageDeleted ? "Message deleted and report resolved." : result.report.status === "OPEN" ? "Report reopened." : `Report ${result.report.status.toLowerCase()}.` });
      await queryClient.invalidateQueries({ queryKey: ["forge-reports", forgeId] });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const reports = reportsQuery.data?.reports ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={status === value ? "rounded-full border border-amber-500/45 bg-amber-950/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100" : "rounded-full border border-slate-700/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-100"}
          >
            {value === "OPEN" ? `Open${reportsQuery.data ? ` (${reportsQuery.data.openCount})` : ""}` : value.toLowerCase()}
          </button>
        ))}
      </div>
      {reportsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400">{status === "OPEN" ? "Nothing to review. Members can report a message from its hover menu." : "None yet."}</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="space-y-2 rounded-[14px] border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 font-semibold text-rose-100">{reportReasonLabels[report.reason] ?? report.reason}</span>
                <span>#{report.channelName ?? "channel"}</span>
                <span>· reported {new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <blockquote className="rounded-[10px] border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                <span className="font-semibold text-slate-50">@{report.authorUsername ?? "unknown"}</span>: <span className="break-words">{report.contentSnapshot}</span>
              </blockquote>
              {report.details ? <p className="text-xs text-slate-300">Reporter&apos;s note: {report.details}</p> : null}
              {report.status !== "OPEN" ? (
                <p className="text-[11px] text-slate-500">
                  {report.status.toLowerCase()} by {report.handledBy?.username ?? "a moderator"}{report.handledAt ? ` · ${new Date(report.handledAt).toLocaleString()}` : ""}{report.resolutionNote ? ` · ${report.resolutionNote}` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {report.status === "OPEN" ? (
                  <>
                    <button type="button" className={dangerBtn} disabled={handleMutation.isPending} onClick={() => handleMutation.mutate({ reportId: report.id, status: "RESOLVED", deleteMessage: true })}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete message
                    </button>
                    <button type="button" className={ghostBtn} disabled={handleMutation.isPending} onClick={() => handleMutation.mutate({ reportId: report.id, status: "RESOLVED" })}>
                      <Check className="h-3.5 w-3.5" /> Resolved
                    </button>
                    <button type="button" className={ghostBtn} disabled={handleMutation.isPending} onClick={() => handleMutation.mutate({ reportId: report.id, status: "DISMISSED" })}>
                      <X className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </>
                ) : (
                  <button type="button" className={ghostBtn} disabled={handleMutation.isPending} onClick={() => handleMutation.mutate({ reportId: report.id, status: "OPEN" })}>
                    Reopen
                  </button>
                )}
              </div>
              {report.status === "OPEN" ? <p className="text-[10px] text-slate-500">To time out or ban the author, use the Members tab.</p> : null}
            </li>
          ))}
        </ul>
      )}
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
  const [transferTo, setTransferTo] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: () => transferForgeOwnership(accessToken, csrfToken, forge.id, { userId: transferTo, confirmName: transferConfirm.trim() }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Ownership transferred. You're now a regular member." });
      setTransferTo("");
      setTransferConfirm("");
      await queryClient.invalidateQueries();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const transferCandidates = forge.members.filter((member) => member.userId !== forge.ownerId);

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
      <div className="space-y-4">
      <div className="space-y-3 rounded-[14px] border border-amber-500/30 bg-amber-950/10 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-100"><Crown className="h-4 w-4" /> Transfer ownership</h3>
        <p className="text-xs text-slate-300">
          Hand <strong>{forge.name}</strong> to another member. They get the Owner role and full control, and you become a regular member with your other roles. Only the new owner can undo it.
        </p>
        {transferCandidates.length ? (
          <>
            <select className={inputClass} value={transferTo} onChange={(event) => setTransferTo(event.target.value)} aria-label="New owner">
              <option value="">Choose the new owner</option>
              {transferCandidates.map((member) => (
                <option key={member.userId} value={member.userId}>{member.nickname ? `${member.nickname} (@${member.user.username})` : member.user.username}</option>
              ))}
            </select>
            {transferTo ? (
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Type the forge name to confirm</span>
                <input className={inputClass} value={transferConfirm} onChange={(event) => setTransferConfirm(event.target.value)} placeholder={forge.name} />
              </label>
            ) : null}
            <button
              type="button"
              className={dangerBtn}
              disabled={!transferTo || transferConfirm.trim().toLowerCase() !== forge.name.trim().toLowerCase() || transferMutation.isPending}
              onClick={() => transferMutation.mutate()}
            >
              {transferMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />} Transfer ownership
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">Nobody else is in this forge yet.</p>
        )}
      </div>
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
