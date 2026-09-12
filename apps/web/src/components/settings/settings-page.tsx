"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, KeyRound, Link2, Loader2, LogOut, Shield, ShieldCheck, Users, X, Zap, ScrollText, Puzzle } from "lucide-react";
import {
  changePassword,
  getForge,
  getSettings,
  revokeSession,
  updateAccountSettings,
  updateLinkedAccounts,
  updatePrivacySettings,
  type PrivacySettings,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const privacyRows: Array<{ key: keyof Omit<PrivacySettings, "contentFilter">; label: string; hint: string }> = [
  { key: "showOnlineStatus", label: "Show online status", hint: "Let others see when you are online." },
  { key: "allowFriendRequests", label: "Allow friend requests", hint: "Anyone can send you a request." },
  { key: "allowDmsFromFriends", label: "Allow DMs from friends", hint: "Friends can message you directly." },
  { key: "allowDmsFromMembers", label: "Allow DMs from members", hint: "Members of your forges can message you." },
  { key: "showActivity", label: "Show activity", hint: "Display the game or stream you are on." },
  { key: "showJoinedServers", label: "Show joined servers", hint: "List your forges on your profile." },
];

const linkedProviders = [
  { key: "discord", label: "Discord", placeholder: "username" },
  { key: "kick", label: "Kick", placeholder: "channel" },
  { key: "twitch", label: "Twitch", placeholder: "channel" },
  { key: "youtube", label: "YouTube", placeholder: "@handle or channel URL" },
  { key: "x", label: "X", placeholder: "@handle" },
  { key: "instagram", label: "Instagram", placeholder: "@handle" },
];

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? "border-amber-400 bg-amber-400" : "border-white/15 bg-slate-800"} disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${checked ? "left-[22px] bg-slate-950" : "left-0.5 bg-slate-400"}`} style={{ height: 18, width: 18 }} />
    </button>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user, clearSession, fetchMe } = useAuthStore();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", accessToken],
    queryFn: () => getSettings(accessToken!),
    enabled: Boolean(accessToken),
  });
  const forgeQuery = useQuery({
    queryKey: ["forge", selectedForgeId, accessToken],
    queryFn: () => getForge(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [clanTag, setClanTag] = useState("");
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [linked, setLinked] = useState<Record<string, string>>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data || seeded) return;
    setDisplayName(data.account.displayName ?? "");
    setEmail(data.account.email);
    setBio(data.account.bio ?? "");
    setClanTag(data.account.clanTag ?? "");
    setPrivacy(data.privacy);
    setLinked(Object.fromEntries(Object.entries(data.linkedAccounts).map(([key, value]) => [key, value ?? ""])));
    setSeeded(true);
  }, [settingsQuery.data, seeded]);

  const account = settingsQuery.data?.account;
  const accountDirty = Boolean(account) && (displayName !== (account?.displayName ?? "") || email !== account?.email || bio !== (account?.bio ?? "") || clanTag !== (account?.clanTag ?? ""));
  const privacyDirty = Boolean(privacy && settingsQuery.data) && JSON.stringify(privacy) !== JSON.stringify(settingsQuery.data?.privacy);
  const linkedDirty = Boolean(settingsQuery.data) && linkedProviders.some((provider) => (linked[provider.key] ?? "") !== (settingsQuery.data?.linkedAccounts[provider.key] ?? ""));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await fetchMe();
  };

  const accountMutation = useMutation({
    mutationFn: () =>
      updateAccountSettings(accessToken!, csrfToken!, {
        displayName: displayName !== (account?.displayName ?? "") ? displayName || null : undefined,
        email: email !== account?.email ? email : undefined,
        bio: bio !== (account?.bio ?? "") ? bio || null : undefined,
        clanTag: clanTag !== (account?.clanTag ?? "") ? clanTag || null : undefined,
      }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Account updated." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const privacyMutation = useMutation({
    mutationFn: () => updatePrivacySettings(accessToken!, csrfToken!, privacy!),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Privacy settings saved." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const linkedMutation = useMutation({
    mutationFn: () => updateLinkedAccounts(accessToken!, csrfToken!, Object.fromEntries(linkedProviders.map((provider) => [provider.key, linked[provider.key]?.trim() || null]))),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Linked accounts saved." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(accessToken!, csrfToken!, { currentPassword, newPassword }),
    onSuccess: async (result) => {
      setCurrentPassword("");
      setNewPassword("");
      setNotice({ tone: "ok", text: result.message });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(accessToken!, csrfToken!, sessionId),
    onSuccess: refresh,
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const forge = forgeQuery.data?.forge;
  const isOwner = forge?.ownerId === user?.id;

  if (settingsQuery.isLoading || !privacy) {
    return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="nf-heading text-xl font-bold text-white">Settings</h1>
        <p className="text-xs text-slate-400">Manage your account, privacy, and community settings.</p>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Account */}
        <section className={`${panel} space-y-4`}>
          <h2 className={sectionTitle}>Account Settings</h2>
          <div className="space-y-3">
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Username</span>
              <input className={`${inputClass} opacity-70`} value={account?.username ?? ""} disabled />
            </label>
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Display name</span>
              <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} placeholder={account?.username} />
            </label>
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Email {account?.emailVerified ? <span className="text-emerald-300">· verified</span> : <span className="text-amber-300">· unverified</span>}</span>
              <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Bio</span>
                <input className={inputClass} value={bio} onChange={(event) => setBio(event.target.value)} maxLength={512} placeholder="Gaming. Streaming. Creating." />
              </label>
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Clan tag</span>
                <input className={inputClass} value={clanTag} onChange={(event) => setClanTag(event.target.value.toUpperCase())} maxLength={12} placeholder="VXR" />
              </label>
            </div>
            <button type="button" className={goldBtn} disabled={!accountDirty || accountMutation.isPending} onClick={() => accountMutation.mutate()}>
              {accountMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save changes
            </button>
          </div>

          <div className="border-t border-white/5 pt-4">
            <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"><KeyRound className="h-3.5 w-3.5" /> Password</p>
            <div className="space-y-2">
              <input className={inputClass} type="password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <input className={inputClass} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <button type="button" className={ghostBtn} disabled={currentPassword.length < 8 || newPassword.length < 8 || passwordMutation.isPending} onClick={() => passwordMutation.mutate()}>
                {passwordMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Change password
              </button>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Two-factor authentication</p>
              <Toggle checked={false} onChange={() => undefined} disabled />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Authenticator-app 2FA is not available yet. It will appear here when it ships.</p>
          </div>

          <div className="border-t border-white/5 pt-4">
            <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"><Link2 className="h-3.5 w-3.5" /> Linked accounts</p>
            <div className="space-y-2">
              {linkedProviders.map((provider) => (
                <label key={provider.key} className="grid grid-cols-[84px_1fr] items-center gap-2 text-xs">
                  <span className="text-slate-300">{provider.label}</span>
                  <input className={`${inputClass} h-9`} value={linked[provider.key] ?? ""} onChange={(event) => setLinked((current) => ({ ...current, [provider.key]: event.target.value }))} placeholder={provider.placeholder} maxLength={120} />
                </label>
              ))}
              <button type="button" className={ghostBtn} disabled={!linkedDirty || linkedMutation.isPending} onClick={() => linkedMutation.mutate()}>
                {linkedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save links
              </button>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className={`${panel} space-y-4`}>
          <h2 className={sectionTitle}>Privacy &amp; Safety</h2>
          <ul className="space-y-3">
            {privacyRows.map((row) => (
              <li key={row.key} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-100">{row.label}</p>
                  <p className="text-[11px] text-slate-500">{row.hint}</p>
                </div>
                <Toggle checked={privacy[row.key]} onChange={(value) => setPrivacy((current) => (current ? { ...current, [row.key]: value } : current))} />
              </li>
            ))}
          </ul>
          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Content filter</span>
            <select className={inputClass} value={privacy.contentFilter} onChange={(event) => setPrivacy((current) => (current ? { ...current, contentFilter: event.target.value as PrivacySettings["contentFilter"] } : current))}>
              <option value="everyone">Filter media from everyone (recommended)</option>
              <option value="friends">Filter media except from friends</option>
              <option value="off">Do not filter</option>
            </select>
          </label>
          <button type="button" className={goldBtn} disabled={!privacyDirty || privacyMutation.isPending} onClick={() => privacyMutation.mutate()}>
            {privacyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />} Save privacy
          </button>

          <div className="border-t border-white/5 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active sessions</p>
            <ul className="space-y-1.5">
              {(settingsQuery.data?.sessions ?? []).map((session, index) => (
                <li key={session.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2 text-xs">
                  <span className="text-slate-300">
                    {index === 0 ? "This device" : "Session"} · signed in {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                  <button type="button" onClick={() => revokeMutation.mutate(session.id)} className="text-slate-500 hover:text-rose-300" title="Sign out this session"><LogOut className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                clearSession();
                window.location.href = "/login";
              }}
              className={`${ghostBtn} mt-3 text-rose-200`}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </section>

        {/* Server */}
        <section className="space-y-4">
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={sectionTitle}>Server Roles</h2>
              {forge ? <span className="text-[11px] text-slate-500">{forge.name}</span> : null}
            </div>
            {forge ? (
              <ul className="space-y-1.5">
                {forge.roles.map((role) => {
                  const holders = forge.members.filter((member) => member.roleLinks.some((link) => link.roleId === role.id)).length;
                  return (
                    <li key={role.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                      <span className="flex-1 text-sm" style={{ color: role.color }}>{role.name}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Users className="h-3 w-3" /> {holders}</span>
                    </li>
                  );
                })}
                {!forge.roles.length ? <li className="text-sm text-slate-500">No roles yet.</li> : null}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Select a forge to see its roles.</p>
            )}
            <Link href={selectedForgeId ? `/app/chat?forge=${selectedForgeId}` : "/app/chat"} className={`${goldBtn} mt-3`}>
              <Shield className="h-3.5 w-3.5" /> Manage roles
            </Link>
          </div>

          <div className={panel}>
            <h2 className={`${sectionTitle} mb-3`}>Server Settings</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                <span>Your role</span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-amber-200">{isOwner ? "Owner" : "Member"}</span>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                <span>Members</span>
                <span className="text-slate-400">{forge?.members.length ?? 0}</span>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                <span>Channels</span>
                <span className="text-slate-400">{forge?.channels.length ?? 0}</span>
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">Name, description, visibility and channels are managed from the forge&apos;s Manage panel in Chat.</p>
          </div>

          <div className={panel}>
            <h2 className={`${sectionTitle} mb-3`}>Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "View audit logs", href: "/admin", icon: ScrollText },
                { label: "Server boost", href: "/core-plus", icon: Zap },
                { label: "Apps & integrations", href: "/developer", icon: Puzzle },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2.5 text-sm text-slate-200 transition hover:border-amber-400/50 hover:text-white">
                  <action.icon className="h-4 w-4 text-amber-300" /> {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
