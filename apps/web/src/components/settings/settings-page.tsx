"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Bell,
  Check,
  CreditCard,
  Gavel,
  Headphones,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Mic,
  Palette,
  Puzzle,
  ScrollText,
  Shield,
  UserRound,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  changePassword,
  getAvatar,
  getBillingEntitlements,
  getForge,
  getSettings,
  listForgeBans,
  listMyBots,
  revokeSession,
  sendSensitiveChallenge,
  updateAccountSettings,
  updateLinkedAccounts,
  updatePreferences,
  updatePrivacySettings,
  type AppearancePreferences,
  type NotificationPreferences,
  type PrivacySettings,
  type VoicePreferences,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AccountProtection } from "@/components/settings/account-protection";
import { AgeVerificationCard } from "@/components/settings/age-verification";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";

// Category list from the design reference (Settings panel, left column).
const categories = [
  { key: "account", label: "Account", icon: UserRound },
  { key: "avatar", label: "Avatar & Profile", icon: Palette },
  { key: "privacy", label: "Privacy & Safety", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "voice", label: "Voice & Video", icon: Headphones },
  { key: "connections", label: "Connections", icon: Link2 },
  { key: "integrations", label: "Integrations", icon: Puzzle },
  { key: "roles", label: "Roles & Permissions", icon: Users },
  { key: "moderation", label: "Moderation", icon: Gavel },
  { key: "billing", label: "Billing & Subscriptions", icon: CreditCard },
] as const;
type CategoryKey = (typeof categories)[number]["key"];

const notificationRows: Array<{ key: keyof NotificationPreferences; label: string; hint: string }> = [
  { key: "mentions", label: "Mentions", hint: "When someone @mentions you in a channel." },
  { key: "directMessages", label: "Direct messages", hint: "New DMs and group messages." },
  { key: "friendRequests", label: "Friend requests", hint: "Requests and accepted requests." },
  { key: "eventReminders", label: "Event reminders", hint: "Events you RSVP'd to are about to start." },
  { key: "liveAlerts", label: "Live alerts", hint: "Creators you follow go live." },
  { key: "system", label: "System", hint: "Account, security and review updates." },
  { key: "sounds", label: "Notification sounds", hint: "Play a sound for new notifications." },
  { key: "push", label: "Push notifications", hint: "Deliver to this device even when Vexora is closed." },
];

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
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading settings...</p>}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const searchParams = useSearchParams();
  const highlightProtection = searchParams?.get("verify") === "1";
  const highlightAge = searchParams?.get("age") === "1";
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
  const [sensitiveCode, setSensitiveCode] = useState("");
  const [sensitiveSent, setSensitiveSent] = useState<{ devCode?: string } | null>(null);
  const [seeded, setSeeded] = useState(false);
  const requestedCategory = searchParams?.get("section") as CategoryKey | null;
  const [category, setCategory] = useState<CategoryKey>(requestedCategory && categories.some((entry) => entry.key === requestedCategory) ? requestedCategory : "account");
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null);
  const [appearance, setAppearance] = useState<AppearancePreferences | null>(null);
  const [voice, setVoice] = useState<VoicePreferences | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data || seeded) return;
    setDisplayName(data.account.displayName ?? "");
    setEmail(data.account.email);
    setBio(data.account.bio ?? "");
    setClanTag(data.account.clanTag ?? "");
    setPrivacy(data.privacy);
    setLinked(Object.fromEntries(Object.entries(data.linkedAccounts).map(([key, value]) => [key, value ?? ""])));
    setNotifications(data.preferences.notifications);
    setAppearance(data.preferences.appearance);
    setVoice(data.preferences.voice);
    setSeeded(true);
  }, [settingsQuery.data, seeded]);

  const avatarQuery = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => getAvatar(accessToken!),
    enabled: Boolean(accessToken) && category === "avatar",
  });
  const billingQuery = useQuery({
    queryKey: ["billing-entitlements", accessToken],
    queryFn: () => getBillingEntitlements(accessToken!),
    enabled: Boolean(accessToken) && category === "billing",
  });
  const botsQuery = useQuery({
    queryKey: ["my-bots", accessToken],
    queryFn: () => listMyBots(accessToken!),
    enabled: Boolean(accessToken) && category === "integrations",
  });
  const bansQuery = useQuery({
    queryKey: ["forge-bans", selectedForgeId, accessToken],
    queryFn: () => listForgeBans(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId) && category === "moderation",
    retry: false,
  });

  // Live preview of appearance changes before they are saved.
  useEffect(() => {
    if (!appearance) return;
    const root = document.documentElement;
    root.dataset.accent = appearance.accent;
    root.dataset.density = appearance.density;
    root.dataset.font = appearance.fontScale;
    root.dataset.motion = appearance.reduceMotion ? "reduce" : "";
    root.dataset.chatAvatars = appearance.showAvatarsInChat ? "on" : "off";
  }, [appearance]);

  const detectDevices = async () => {
    setDeviceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list);
      // Meter the mic for a few seconds so the user can see input is working.
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const started = Date.now();
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setMicLevel(Math.min(100, Math.round((data.reduce((sum, value) => sum + value, 0) / data.length / 128) * 100)));
        if (Date.now() - started < 8000) requestAnimationFrame(tick);
        else {
          stream.getTracks().forEach((track) => track.stop());
          void context.close();
          setMicLevel(0);
        }
      };
      tick();
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : "Microphone access was denied");
    }
  };

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
        code: sensitiveCode || undefined,
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
  const sensitiveMutation = useMutation({
    mutationFn: () => sendSensitiveChallenge(accessToken!, csrfToken!),
    onSuccess: (result) => {
      setSensitiveSent({ devCode: result.devCode });
      setNotice({ tone: "ok", text: "Confirmation code sent to your verified email and phone." });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(accessToken!, csrfToken!, { currentPassword, newPassword, code: sensitiveCode || undefined }),
    onSuccess: async (result) => {
      setCurrentPassword("");
      setNewPassword("");
      setSensitiveCode("");
      setSensitiveSent(null);
      setNotice({ tone: "ok", text: result.message });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const preferencesMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updatePreferences>[2]) => updatePreferences(accessToken!, csrfToken!, payload),
    onSuccess: async (result) => {
      setNotifications(result.preferences.notifications);
      setAppearance(result.preferences.appearance);
      setVoice(result.preferences.voice);
      setNotice({ tone: "ok", text: "Preferences saved." });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const notificationsDirty = Boolean(notifications && settingsQuery.data) && JSON.stringify(notifications) !== JSON.stringify(settingsQuery.data?.preferences.notifications);
  const appearanceDirty = Boolean(appearance && settingsQuery.data) && JSON.stringify(appearance) !== JSON.stringify(settingsQuery.data?.preferences.appearance);
  const voiceDirty = Boolean(voice && settingsQuery.data) && JSON.stringify(voice) !== JSON.stringify(settingsQuery.data?.preferences.voice);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Settings</h1>
          <p className="text-xs text-slate-400">Manage your account, privacy, and community settings.</p>
        </div>
        {account ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0d1119] px-3 py-2">
            {account.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatar} alt="" className="h-9 w-9 rounded-full border border-amber-500/40 object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/40 bg-slate-800 text-xs font-bold text-amber-100">{account.username.slice(0, 2).toUpperCase()}</span>
            )}
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">{account.displayName || account.username}</p>
              <p className="text-[11px] text-slate-500">@{account.username}</p>
            </div>
            <Link href="/app/profile" className={`${ghostBtn} ml-2`}>Edit profile</Link>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[212px_minmax(0,1fr)]">
        {/* Category column from the design reference */}
        <nav className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-2 lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
            {categories.map((entry) => {
              const active = entry.key === category;
              return (
                <li key={entry.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategory(entry.key)}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                      active ? "border-amber-400/60 bg-amber-500/10 text-amber-100" : "border-transparent text-slate-300 hover:bg-white/[0.03] hover:text-white"
                    }`}
                  >
                    <entry.icon className={`h-4 w-4 ${active ? "text-amber-300" : "text-slate-500"}`} />
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          {category === "account" ? (
            <>
      {settingsQuery.data?.twoFactor.enabled || sensitiveSent ? (
        <div className="rounded-2xl border border-amber-500/25 bg-[#0d1119] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Confirmation code for sensitive changes</p>
          <p className="mb-2 text-xs text-slate-400">Two-factor is on, so changing your email or password needs a fresh code.</p>
          {sensitiveSent?.devCode ? <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Development mode: the code is <span className="font-mono font-bold">{sensitiveSent.devCode}</span>.</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} disabled={sensitiveMutation.isPending} onClick={() => sensitiveMutation.mutate()}>{sensitiveSent ? "Resend code" : "Send code"}</button>
            <input className={`${inputClass} max-w-[200px]`} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={sensitiveCode} onChange={(event) => setSensitiveCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
        </div>
      ) : null}

              <div className="grid gap-4 xl:grid-cols-3">
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
              <AccountProtection highlight={highlightProtection} />
              <AgeVerificationCard highlight={highlightAge} />
            </>
          ) : null}

          {category === "avatar" ? (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <section className={panel}>
                <h2 className={`${sectionTitle} mb-3`}>Your avatar</h2>
                <div className="flex justify-center rounded-xl border border-white/5 bg-[#11151e] p-3">
                  <AvatarRenderer config={avatarQuery.data?.config ?? defaultAvatarConfig} size={220} />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {avatarQuery.data ? `${avatarQuery.data.presets.length}/${avatarQuery.data.maxPresets} saved presets.` : "Loading avatar..."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/app/avatar" className={goldBtn}>Open Avatar Studio</Link>
                  <Link href="/app/wardrobe" className={ghostBtn}>Wardrobe</Link>
                </div>
              </section>
              <section className={`${panel} space-y-4`}>
                <h2 className={sectionTitle}>Profile</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-300">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Display name</span>
                    <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} placeholder={account?.username} />
                  </label>
                  <label className="block text-xs text-slate-300">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Clan tag</span>
                    <input className={inputClass} value={clanTag} onChange={(event) => setClanTag(event.target.value.toUpperCase())} maxLength={12} placeholder="VXR" />
                  </label>
                </div>
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Bio</span>
                  <textarea className={`${inputClass} h-24 resize-none py-2`} value={bio} onChange={(event) => setBio(event.target.value)} maxLength={512} placeholder="Gaming. Streaming. Creating." />
                </label>
                <button type="button" className={goldBtn} disabled={!accountDirty || accountMutation.isPending} onClick={() => accountMutation.mutate()}>
                  {accountMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save changes
                </button>
                <p className="text-[11px] text-slate-500">Your avatar, banner, badges and posts are managed from your profile page.</p>
                <Link href="/app/profile" className={ghostBtn}>View profile</Link>
              </section>
            </div>
          ) : null}

          {category === "privacy" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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

              <div className="space-y-4">
                <AccountProtection highlight={highlightProtection} />
                <AgeVerificationCard highlight={highlightAge} />
              </div>
            </div>
          ) : null}

          {category === "notifications" && notifications ? (
            <section className={`${panel} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className={sectionTitle}>Notifications</h2>
                <Link href="/app/notifications" className={ghostBtn}><Bell className="h-3.5 w-3.5" /> Open inbox</Link>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {notificationRows.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2.5">
                    <div>
                      <p className="text-sm text-slate-100">{row.label}</p>
                      <p className="text-[11px] text-slate-500">{row.hint}</p>
                    </div>
                    <Toggle checked={notifications[row.key]} onChange={(value) => setNotifications((current) => (current ? { ...current, [row.key]: value } : current))} />
                  </li>
                ))}
              </ul>
              <button type="button" className={goldBtn} disabled={!notificationsDirty || preferencesMutation.isPending} onClick={() => preferencesMutation.mutate({ notifications })}>
                {preferencesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save notifications
              </button>
            </section>
          ) : null}

          {category === "appearance" && appearance ? (
            <section className={`${panel} space-y-5`}>
              <h2 className={sectionTitle}>Appearance</h2>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Accent</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "gold", label: "Vexora Gold", color: "#e6b325" },
                    { key: "ember", label: "Ember", color: "#ff7a2f" },
                    { key: "ice", label: "Ice", color: "#37c6ff" },
                    { key: "violet", label: "Violet", color: "#a466ff" },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAppearance((current) => (current ? { ...current, accent: option.key } : current))}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${appearance.accent === option.key ? "border-amber-400/60 bg-amber-500/10 text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: option.color }} /> {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Message density</span>
                  <select className={inputClass} value={appearance.density} onChange={(event) => setAppearance((current) => (current ? { ...current, density: event.target.value as AppearancePreferences["density"] } : current))}>
                    <option value="cozy">Cozy</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Text size</span>
                  <select className={inputClass} value={appearance.fontScale} onChange={(event) => setAppearance((current) => (current ? { ...current, fontScale: event.target.value as AppearancePreferences["fontScale"] } : current))}>
                    <option value="small">Small</option>
                    <option value="default">Default</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-100">Reduce motion</p>
                    <p className="text-[11px] text-slate-500">Turn off animations and transitions.</p>
                  </div>
                  <Toggle checked={appearance.reduceMotion} onChange={(value) => setAppearance((current) => (current ? { ...current, reduceMotion: value } : current))} />
                </li>
                <li className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-100">Show avatars in chat</p>
                    <p className="text-[11px] text-slate-500">Hide them for a denser message list.</p>
                  </div>
                  <Toggle checked={appearance.showAvatarsInChat} onChange={(value) => setAppearance((current) => (current ? { ...current, showAvatarsInChat: value } : current))} />
                </li>
              </ul>
              <p className="text-[11px] text-slate-500">Changes preview instantly and apply everywhere once saved.</p>
              <button type="button" className={goldBtn} disabled={!appearanceDirty || preferencesMutation.isPending} onClick={() => preferencesMutation.mutate({ appearance })}>
                {preferencesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save appearance
              </button>
            </section>
          ) : null}

          {category === "voice" && voice ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className={`${panel} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h2 className={`${sectionTitle} inline-flex items-center gap-2`}><Mic className="h-4 w-4 text-amber-300" /> Voice</h2>
                  <button type="button" className={ghostBtn} onClick={() => void detectDevices()}>Detect devices</button>
                </div>
                {deviceError ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{deviceError}</p> : null}
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Input device</span>
                  <select className={inputClass} value={voice.inputDeviceId ?? ""} onChange={(event) => setVoice((current) => (current ? { ...current, inputDeviceId: event.target.value || null } : current))}>
                    <option value="">System default</option>
                    {devices.filter((device) => device.kind === "audioinput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Output device</span>
                  <select className={inputClass} value={voice.outputDeviceId ?? ""} onChange={(event) => setVoice((current) => (current ? { ...current, outputDeviceId: event.target.value || null } : current))}>
                    <option value="">System default</option>
                    {devices.filter((device) => device.kind === "audiooutput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Speakers"}</option>)}
                  </select>
                </label>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500"><span>Mic test</span><span>{micLevel}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${micLevel}%` }} /></div>
                  <p className="mt-1 text-[11px] text-slate-500">Click Detect devices and speak to see the meter move.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-300">
                    <span className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500"><span>Input volume</span><span>{voice.inputVolume}</span></span>
                    <input type="range" min={0} max={100} value={voice.inputVolume} onChange={(event) => setVoice((current) => (current ? { ...current, inputVolume: Number(event.target.value) } : current))} className="w-full accent-amber-400" />
                  </label>
                  <label className="block text-xs text-slate-300">
                    <span className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500"><span>Output volume</span><span>{voice.outputVolume}</span></span>
                    <input type="range" min={0} max={100} value={voice.outputVolume} onChange={(event) => setVoice((current) => (current ? { ...current, outputVolume: Number(event.target.value) } : current))} className="w-full accent-amber-400" />
                  </label>
                </div>
                <div className="flex gap-1 rounded-lg border border-white/10 bg-[#11151e] p-1">
                  {(["voice", "ptt"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setVoice((current) => (current ? { ...current, inputMode: mode } : current))} className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${voice.inputMode === mode ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                      {mode === "voice" ? "Voice activity" : "Push to talk"}
                    </button>
                  ))}
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-100">Noise suppression</p>
                    <Toggle checked={voice.noiseSuppression} onChange={(value) => setVoice((current) => (current ? { ...current, noiseSuppression: value } : current))} />
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-100">Echo cancellation</p>
                    <Toggle checked={voice.echoCancellation} onChange={(value) => setVoice((current) => (current ? { ...current, echoCancellation: value } : current))} />
                  </li>
                </ul>
              </section>
              <section className={`${panel} space-y-4`}>
                <h2 className={`${sectionTitle} inline-flex items-center gap-2`}><Video className="h-4 w-4 text-amber-300" /> Video</h2>
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Camera</span>
                  <select className={inputClass} value={voice.cameraDeviceId ?? ""} onChange={(event) => setVoice((current) => (current ? { ...current, cameraDeviceId: event.target.value || null } : current))}>
                    <option value="">System default</option>
                    {devices.filter((device) => device.kind === "videoinput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Camera"}</option>)}
                  </select>
                </label>
                <p className="text-[11px] text-slate-500">Device names appear after you allow microphone access with Detect devices.</p>
                <button type="button" className={goldBtn} disabled={!voiceDirty || preferencesMutation.isPending} onClick={() => preferencesMutation.mutate({ voice })}>
                  {preferencesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save voice &amp; video
                </button>
              </section>
            </div>
          ) : null}

          {category === "connections" ? (
            <section className={`${panel} space-y-4`}>
              <h2 className={sectionTitle}>Connections</h2>
              <p className="text-xs text-slate-400">Linked accounts show on your profile and let followers find you on other platforms.</p>
          <div>
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
          ) : null}

          {category === "integrations" ? (
            <section className={`${panel} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className={sectionTitle}>Integrations</h2>
                <Link href="/developer" className={goldBtn}><Puzzle className="h-3.5 w-3.5" /> Developer portal</Link>
              </div>
              <p className="text-xs text-slate-400">Bots and apps you own. Invite them to forges from the developer portal.</p>
              {botsQuery.isLoading ? <p className="text-sm text-slate-400">Loading...</p> : null}
              {botsQuery.data?.bots.length ? (
                <ul className="space-y-2">
                  {botsQuery.data.bots.map((bot) => (
                    <li key={bot.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-amber-200">{bot.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{bot.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{bot.description || "No description"}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{bot.isPublic ? "Public" : "Private"}</span>
                    </li>
                  ))}
                </ul>
              ) : botsQuery.data ? (
                <p className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-3 text-sm text-slate-500">You have not created any bots or apps yet.</p>
              ) : null}
            </section>
          ) : null}

          {category === "roles" ? (
            <div className="grid gap-4 xl:grid-cols-2">
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
                <h2 className={`${sectionTitle} mb-3`}>Your permissions</h2>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2"><span>Forge</span><span className="text-slate-400">{forge?.name ?? "None selected"}</span></li>
                  <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2"><span>Your role</span><span className="text-[11px] uppercase tracking-[0.14em] text-amber-200">{isOwner ? "Owner" : "Member"}</span></li>
                  <li className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2"><span>Roles held</span><span className="text-slate-400">{forge?.members.find((member) => member.user.id === user?.id)?.roleLinks.length ?? 0}</span></li>
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">Role permissions (manage channels, kick, ban, mention everyone) are edited in the forge&apos;s Manage panel.</p>
              </div>
            </div>
          ) : null}

          {category === "moderation" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className={panel}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className={sectionTitle}>Bans</h2>
                  {forge ? <span className="text-[11px] text-slate-500">{forge.name}</span> : null}
                </div>
                {bansQuery.isLoading ? <p className="text-sm text-slate-400">Loading...</p> : null}
                {bansQuery.isError ? <p className="text-sm text-slate-500">Only forge moderators can see the ban list.</p> : null}
                {bansQuery.data ? (
                  bansQuery.data.bans.length ? (
                    <ul className="space-y-2">
                      {bansQuery.data.bans.map((ban) => (
                        <li key={ban.id} className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-2 text-sm">
                          <p className="text-white">@{ban.user.username}</p>
                          <p className="text-[11px] text-slate-500">{ban.reason || "No reason given"} · by @{ban.bannedBy.username} · {new Date(ban.createdAt).toLocaleDateString()}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-3 text-sm text-slate-500">No banned members.</p>
                  )
                ) : null}
                <Link href={selectedForgeId ? `/app/chat?forge=${selectedForgeId}` : "/app/chat"} className={`${goldBtn} mt-3`}><Gavel className="h-3.5 w-3.5" /> Open moderation tools</Link>
              </section>
              <section className="space-y-4">
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
          ) : null}

          {category === "billing" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className={`${panel} space-y-3`}>
                <h2 className={sectionTitle}>Subscription</h2>
                <div className="rounded-xl border border-amber-500/25 bg-[#11151e] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Current plan</p>
                  <p className="nf-heading mt-1 text-2xl font-bold text-amber-300">{account?.premiumTier && account.premiumTier !== "NONE" ? `Core+ ${account.premiumTier}` : "Free"}</p>
                  {billingQuery.data?.premium.subscription ? (
                    <p className="mt-1 text-xs text-slate-400">
                      {billingQuery.data.premium.subscription.status.toLowerCase()} · billed {billingQuery.data.premium.subscription.interval.toLowerCase()}
                      {billingQuery.data.premium.subscription.currentPeriodEnd ? ` · renews ${new Date(billingQuery.data.premium.subscription.currentPeriodEnd).toLocaleDateString()}` : ""}
                      {billingQuery.data.premium.subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">No active subscription.</p>
                  )}
                </div>
                <Link href="/core-plus" className={goldBtn}><Zap className="h-3.5 w-3.5" /> {account?.premiumTier && account.premiumTier !== "NONE" ? "Manage plan" : "Upgrade to Core+"}</Link>
              </section>
              <section className={`${panel} space-y-3`}>
                <h2 className={sectionTitle}>Entitlements</h2>
                {billingQuery.isLoading ? <p className="text-sm text-slate-400">Loading...</p> : null}
                {billingQuery.data ? (
                  billingQuery.data.entitlements.length ? (
                    <ul className="space-y-2">
                      {billingQuery.data.entitlements.map((entry) => (
                        <li key={entry.featureCode} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#11151e] px-3 py-2 text-sm">
                          <span className="text-slate-200">{entry.featureCode.replace(/_/g, " ").toLowerCase()}</span>
                          <span className="text-slate-400">{entry.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-3 text-sm text-slate-500">No paid features on this account.</p>
                  )
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
