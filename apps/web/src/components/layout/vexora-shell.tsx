"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Calendar,
  ChevronDown,
  Coins,
  Compass,
  Hash,
  Home,
  Layers,
  LogOut,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  Radio,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  User,
  UserRound,
  Users,
  Volume2,
  X,
  LifeBuoy,
  Newspaper,
  BellOff,
  Lock,
  ChevronRight,
  MessagesSquare,
  CheckCheck,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { PopoutHost } from "@/components/popout/popout-host";
import { LAYOUT_LIMITS, effectiveLayout, maxDragWidth } from "@/lib/layout/layout-prefs";
import { useLayoutPrefs, useLayoutStore, useViewportWidth } from "@/store/layout-store";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ConsentRenewal } from "@/components/legal/consent-renewal";
import { ForgeNotificationsDialog } from "@/components/chat/forge-notifications-dialog";
import { QuickSwitcher } from "@/components/layout/quick-switcher";
import { GetStartedPanel } from "@/components/layout/get-started-panel";
import { SavedPanel } from "@/components/chat/saved-panel";
import { WhatsNewDialog } from "@/components/updates/whats-new-dialog";
import { alpha, channelHue, hues, hueFor, sectionHue, tileGradient } from "@/lib/colors";
import { markAllForgesRead, markForgeRead, listUnseenUpdates, cancelAccountDeletion, getApiErrorMessage, getForge, getForgePermissions, getForgeUnreads, getProtectionStatus, getDmUnread, getSettings, getUnreadSummary, getVoiceOccupancy, listForges, markChannelRead, setPresenceStatus, type Channel } from "@/lib/api";
import { listNotifications } from "@/lib/notifications-api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { ServerContextMenu } from "@/components/layout/server-context-menu";
import { serverMenuItems, type ServerMenuItem } from "@/components/layout/server-menu-model";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useVoiceStore } from "@/store/voice-store";
import { useServerViewStore } from "@/store/server-view-store";
import { serverLandingHref } from "@/lib/server-routes";
import { VoiceEngine } from "@/components/chat/voice-engine";
import { AppearanceRuntime } from "@/components/appearance/appearance-runtime";
import { playCue } from "@/lib/sound/sound-engine";
import { useEscapeKey } from "@/lib/use-escape-key";

// The sidebar, grouped so people can find their way: Home, then Community, Create, Shop and Account.
// `matches` lists older paths that should still light up this entry (the Shop covers the outfit store).
type NavLink = { label: string; href: string; icon: typeof Home; group: string; matches?: string[] };
const navLinks: NavLink[] = [
  { label: "Home", href: "/app", icon: Home, group: "" },
  { label: "Feed", href: "/app/feed", icon: Newspaper, group: "Community" },
  { label: "Community", href: "/app/server", icon: Layers, group: "Community" },
  { label: "Events", href: "/app/events", icon: Calendar, group: "Community" },
  { label: "Avatar Studio", href: "/app/avatar", icon: UserRound, group: "Create" },
  { label: "Shop", href: "/app/shop", icon: ShoppingBag, group: "Shop", matches: ["/app/store"] },
  { label: "My wardrobe", href: "/app/wardrobe", icon: Shirt, group: "Shop" },
  { label: "Rewards & Coins", href: "/app/rewards", icon: Coins, group: "Shop" },
  { label: "Settings", href: "/app/settings", icon: Settings, group: "Account" },
  { label: "Support", href: "/app/support", icon: LifeBuoy, group: "Account" },
  { label: "Download app", href: "/app/downloads", icon: Download, group: "Account" },
];

// Everything else lives on the thin icon rail, like the reference.
const railLinks = [
  { label: "Profile", href: "/app/profile", icon: User },
  { label: "Discover", href: "/app/discover", icon: Compass },
  { label: "Chat", href: "/app/chat", icon: MessageSquare },
  { label: "Friends", href: "/app/friends", icon: Users },
  { label: "Live", href: "/app/live", icon: Radio },
];


function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/app" && pathname.startsWith(href));
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "VX"
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, accessToken, csrfToken, clearSession } = useAuthStore();
  const {
    selectedForgeId,
    setSelectedForgeId,
    activeChannelId,
    setActiveChannelId,
    channelCounts,
    forgeCounts,
    setChannelCounts,
    setForgeCounts,
    bumpChannel,
    clearChannel,
  } = useWorkspaceStore();

  const [forgeMenuOpen, setForgeMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const { fetchMe } = useAuthStore();
  const [keeping, setKeeping] = useState(false);
  const [keepError, setKeepError] = useState<string | null>(null);
  const presenceMeta: Record<string, { label: string; dot: string; text: string }> = {
    ONLINE: { label: "Online", dot: "bg-emerald-400", text: "text-emerald-300" },
    IDLE: { label: "Idle", dot: "bg-yellow-300", text: "text-yellow-200" },
    DND: { label: "Do not disturb", dot: "bg-rose-400", text: "text-rose-300" },
    OFFLINE: { label: "Offline", dot: "bg-slate-600", text: "text-slate-400" },
    // You're looking at the app, so your own "offline" can only mean you chose Invisible.
    INVISIBLE: { label: "Invisible", dot: "bg-slate-500 ring-1 ring-slate-300", text: "text-slate-300" },
  };
  const ownStatus = user?.status === "OFFLINE" || !user?.status ? "INVISIBLE" : user.status;
  const presence = presenceMeta[ownStatus] ?? presenceMeta.OFFLINE;
  const changeStatus = async (status: "ONLINE" | "IDLE" | "DND" | "INVISIBLE") => {
    setStatusMenuOpen(false);
    if (!accessToken || !csrfToken) return;
    try {
      await setPresenceStatus(accessToken, csrfToken, status);
      await fetchMe();
    } catch {
      // keep the previous status
    }
  };
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) setStatusMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [statusMenuOpen]);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEscapeKey(mobileOpen, () => setMobileOpen(false));
  const [search, setSearch] = useState("");
  const voiceSession = useVoiceStore((state) => state.session);
  const voiceFlags = useVoiceStore((state) => state.flags);
  const voiceConnection = useVoiceStore((state) => state.connection);
  const voiceRemote = useVoiceStore((state) => state.remote);
  const toggleVoice = useVoiceStore((state) => state.toggle);
  const leaveVoice = useVoiceStore((state) => state.leave);
  const forgeMenuRef = useRef<HTMLDivElement | null>(null);

  const forgesQuery = useQuery({
    queryKey: ["forges", accessToken],
    queryFn: () => listForges(accessToken!),
    enabled: Boolean(accessToken),
  });
  const forges = useMemo(() => forgesQuery.data?.forges ?? [], [forgesQuery.data]);

  // Pick a forge once the list is known, and drop a stale selection.
  useEffect(() => {
    if (!forges.length) return;
    if (!selectedForgeId || !forges.some((forge) => forge.id === selectedForgeId)) {
      setSelectedForgeId(forges[0].id);
    }
  }, [forges, selectedForgeId, setSelectedForgeId]);

  const forgeQuery = useQuery({
    queryKey: ["forge", selectedForgeId, accessToken],
    queryFn: () => getForge(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });
  const forge = forgeQuery.data?.forge;
  const textChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT" || channel.type === "FORUM"), [forge]);
  const voiceChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "VOICE" || channel.type === "STAGE"), [forge]);
  // Categories group channels under a collapsible heading; channels with no (known)
  // category stay in the plain Text / Voice lists at the top.
  const categories = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "CATEGORY").sort((a, b) => a.position - b.position), [forge]);
  const categoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const looseText = useMemo(() => textChannels.filter((channel) => !channel.parentId || !categoryIds.has(channel.parentId)), [textChannels, categoryIds]);
  const looseVoice = useMemo(() => voiceChannels.filter((channel) => !channel.parentId || !categoryIds.has(channel.parentId)), [voiceChannels, categoryIds]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem("vx-collapsed-categories") ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const toggleCategory = (id: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem("vx-collapsed-categories", JSON.stringify([...next]));
      } catch {
        // storage unavailable - collapse just won't persist
      }
      return next;
    });
  };
  const onlineCount = useMemo(() => (forge?.members ?? []).filter((member) => member.user.status !== "OFFLINE").length, [forge]);

  // Who is actually sitting in each voice channel right now.
  const [voiceCounts, setVoiceCounts] = useState<Record<string, number>>({});
  const occupancyQuery = useQuery({
    queryKey: ["voice-occupancy", selectedForgeId, accessToken],
    queryFn: () => getVoiceOccupancy(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
  });
  useEffect(() => {
    if (!occupancyQuery.data) return;
    const next: Record<string, number> = {};
    for (const entry of occupancyQuery.data.channels) next[entry.channelId] = entry.userIds.length;
    setVoiceCounts(next);
  }, [occupancyQuery.data]);

  const unreadsQuery = useQuery({
    queryKey: ["forge-unreads", selectedForgeId, accessToken],
    queryFn: () => getForgeUnreads(accessToken!, selectedForgeId!),
    enabled: Boolean(accessToken && selectedForgeId),
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!unreadsQuery.data) return;
    const next: Record<string, { unread: number; mentions: number }> = {};
    for (const entry of unreadsQuery.data.channels) next[entry.channelId] = { unread: entry.unread, mentions: entry.mentions };
    setChannelCounts(next);
  }, [unreadsQuery.data, setChannelCounts]);

  const summaryQuery = useQuery({
    queryKey: ["unread-summary", accessToken],
    queryFn: () => getUnreadSummary(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!summaryQuery.data) return;
    const next: Record<string, { unread: number; mentions: number }> = {};
    for (const entry of summaryQuery.data.forges) next[entry.forgeId] = { unread: entry.unread, mentions: entry.mentions };
    setForgeCounts(next);
  }, [summaryQuery.data, setForgeCounts]);
  // Muted forges show no unread dot (mention badges still show), like Discord.
  const mutedForgeIds = useMemo(() => new Set((summaryQuery.data?.forges ?? []).filter((entry) => entry.muted).map((entry) => entry.forgeId)), [summaryQuery.data]);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const unseenUpdatesQuery = useQuery({ queryKey: ["updates-unseen", accessToken], queryFn: () => listUnseenUpdates(accessToken!), enabled: Boolean(accessToken), staleTime: 5 * 60_000 });
  const hasUnseenUpdates = Boolean(unseenUpdatesQuery.data?.length);

  const dmUnreadQuery = useQuery({
    queryKey: ["dm-unread", accessToken],
    queryFn: () => getDmUnread(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  const dmUnread = dmUnreadQuery.data?.unread ?? 0;

  const notificationsQuery = useQuery({
    queryKey: ["notifications", accessToken],
    queryFn: () => listNotifications(accessToken!, csrfToken ?? ""),
    enabled: Boolean(accessToken),
    refetchInterval: 45_000,
  });
  const unreadNotifications = notificationsQuery.data?.unreadCount ?? 0;

  const protectionQuery = useQuery({
    queryKey: ["protection", accessToken],
    queryFn: () => getProtectionStatus(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });
  // Appearance preferences (Settings → Appearance) apply to the whole app.
  const settingsQuery = useQuery({
    queryKey: ["settings", accessToken],
    queryFn: () => getSettings(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
  });
  // Applied (with themes, effects, seasonal visuals and sounds) by <AppearanceRuntime> below.

  const protection = protectionQuery.data?.protection;
  const showProtectionBanner = Boolean(protection && !protection.complete && !pathname.startsWith("/app/settings"));

  // Nobody without a confirmed 18+ date of birth gets into the workspace.
  useEffect(() => {
    if (user && user.ageVerificationLevel === "NONE") {
      router.replace(`/age-gate?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // First sign-in: avatar, forge and friends before landing in the workspace.
    if (user && user.onboarded === false) router.replace("/welcome");
  }, [user, pathname, router]);

  // Join every forge room so unread badges tick live, even for forges not currently open.
  useEffect(() => {
    if (!accessToken || !forges.length) return;
    const socket = getSocket(accessToken);
    if (!socket.connected) socket.connect();
    const join = () => {
      forges.forEach((entry) => socket.emit("forge:join", entry.id));
      // Presence is set server-side on connect; pull the fresh status into the footer.
      window.setTimeout(() => {
        void fetchMe();
        // Our own ONLINE presence was set before we joined the forge rooms; refresh member statuses.
        void queryClient.invalidateQueries({ queryKey: ["forge"] });
      }, 600);
    };
    join();

    const handleActivity = (payload: { forgeId: string; channelId: string; authorId: string; mentionedUserIds?: string[]; threadId?: string | null }) => {
      if (payload.authorId === user?.id) return;
      const mentioned = Boolean(user?.id && payload.mentionedUserIds?.includes(user.id));
      // Thread replies don't make the channel unread unless they mention you.
      if (payload.threadId && !mentioned) return;
      bumpChannel(payload.forgeId, payload.channelId, mentioned);
    };
    const handleChannels = (payload: { forgeId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["forge", payload.forgeId, accessToken] });
    };
    const handleDmActivity = (payload: { authorId: string }) => {
      if (payload.authorId === user?.id) return;
      void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
      void queryClient.invalidateQueries({ queryKey: ["dm-threads"] });
    };
    const handleNotification = (payload: { id: string; title: string; quiet?: boolean }) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Quiet hours: the server marks it quiet; it still shows in the inbox, silently.
      // The message cue follows Settings → Notifications → Notification sounds (see AppearanceRuntime).
      if (!payload.quiet) playCue("message");
    };
    const handleVoice = (payload: { channelId: string; count: number }) => {
      setVoiceCounts((current) => ({ ...current, [payload.channelId]: payload.count }));
    };
    const handlePresence = (payload: { forgeId: string; userId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["forge", payload.forgeId, accessToken] });
      // Profile pages and friend lists show the same status; keep them live too.
      void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    };

    socket.on("connect", join);
    socket.on("channel:activity", handleActivity);
    socket.on("forge:channels", handleChannels);
    socket.on("presence:changed", handlePresence);
    socket.on("voice:occupancy", handleVoice);
    socket.on("notification:new", handleNotification);
    socket.on("dm:activity", handleDmActivity);
    return () => {
      socket.off("dm:activity", handleDmActivity);
      socket.off("notification:new", handleNotification);
      socket.off("voice:occupancy", handleVoice);
      socket.off("connect", join);
      socket.off("channel:activity", handleActivity);
      socket.off("forge:channels", handleChannels);
      socket.off("presence:changed", handlePresence);
    };
  }, [accessToken, forges, user?.id, bumpChannel, queryClient, fetchMe]);

  // Leaving the chat page clears the active channel so new messages count as unread again.
  useEffect(() => {
    if (!pathname.startsWith("/app/chat")) setActiveChannelId(null);
  }, [pathname, setActiveChannelId]);

  useEffect(() => {
    if (!forgeMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (forgeMenuRef.current && !forgeMenuRef.current.contains(event.target as Node)) setForgeMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [forgeMenuOpen]);

  const openChannel = (channel: Channel) => {
    if (!selectedForgeId) return;
    setActiveChannelId(channel.id);
    clearChannel(selectedForgeId, channel.id);
    if (accessToken && csrfToken) {
      void markChannelRead(accessToken, csrfToken, channel.id)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["forge-unreads"] });
          void queryClient.invalidateQueries({ queryKey: ["unread-summary"] });
        })
        .catch(() => undefined);
    }
    setMobileOpen(false);
    const param = channel.type === "VOICE" || channel.type === "STAGE" ? "voice" : "channel";
    router.push(`/app/chat?forge=${selectedForgeId}&${param}=${channel.id}`);
  };

  // "Mark as read" for one server, or all of them (like Discord's right-click menu).
  const markRead = async (forgeId: string | "all") => {
    if (!accessToken || !csrfToken) return;
    setForgeMenuOpen(false);
    try {
      if (forgeId === "all") await markAllForgesRead(accessToken, csrfToken);
      else await markForgeRead(accessToken, csrfToken, forgeId);
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["unread-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["forge-unreads"] }),
      ]);
    }
  };

  // Choosing a server always opens it, from Home or anywhere else, on the channel it was last open on.
  const selectForge = (forgeId: string) => {
    setSelectedForgeId(forgeId);
    setForgeMenuOpen(false);
    setMobileOpen(false);
    router.push(serverLandingHref(forgeId, useWorkspaceStore.getState().lastChannelByForge[forgeId]));
  };

  // Right-click on a server in the rail opens its menu. The person's permissions load when it opens.
  const [serverMenu, setServerMenu] = useState<{
    forgeId: string;
    name: string;
    x: number;
    y: number;
    loading: boolean;
    access: { isOwner: boolean; permissions: Partial<Record<string, boolean>> } | undefined;
  } | null>(null);
  const openServerMenu = (forgeId: string, name: string, x: number, y: number) => {
    setServerMenu({ forgeId, name, x, y, loading: Boolean(accessToken), access: undefined });
    if (!accessToken) return;
    queryClient
      .fetchQuery({ queryKey: ["server-menu-access", forgeId, accessToken], queryFn: () => getForgePermissions(accessToken, forgeId), staleTime: 30_000 })
      .then((data) =>
        setServerMenu((menu) => (menu && menu.forgeId === forgeId ? { ...menu, loading: false, access: { isOwner: data.isOwner, permissions: { ...data.permissions } } } : menu)),
      )
      .catch(() => setServerMenu((menu) => (menu && menu.forgeId === forgeId ? { ...menu, loading: false } : menu)));
  };
  const runServerMenuItem = (item: ServerMenuItem) => {
    const menu = serverMenu;
    setServerMenu(null);
    if (!menu) return;
    if (item.action === "read") void markRead(menu.forgeId);
    else if (item.action === "open") selectForge(menu.forgeId);
    else if (item.href) {
      setSelectedForgeId(menu.forgeId);
      setMobileOpen(false);
      router.push(item.href);
    }
  };

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!search.trim()) return;
    router.push(`/app/search?q=${encodeURIComponent(search.trim())}`);
  };

  // Until the account has loaded, say so rather than showing a generic name.
  const displayName = user?.displayName || user?.username || "Your account";

  const renderTextChannel = (channel: Channel) => {
    const counts = channelCounts[channel.id];
    const active = activeChannelId === channel.id;
    return (
      <li key={channel.id}>
        <button
          type="button"
          onClick={() => openChannel(channel)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
            active ? "text-white" : counts?.unread ? "text-white hover:bg-white/[0.05]" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
          )}
          style={active ? { background: `linear-gradient(90deg, ${alpha(hues[channelHue[channel.type]].base, 0.22)}, ${alpha(hues[channelHue[channel.type]].base, 0.04)})`, boxShadow: `inset 2px 0 0 ${hues[channelHue[channel.type]].base}` } : undefined}
        >
          {channel.type === "ANNOUNCEMENT" ? (
            <Megaphone className="h-3.5 w-3.5 shrink-0" style={{ color: hues.orange.base }} />
          ) : channel.type === "FORUM" ? (
            <MessagesSquare className="h-3.5 w-3.5 shrink-0" style={{ color: hues.violet.base }} />
          ) : (
            <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: active || counts?.unread ? hues.sky.light : alpha(hues.sky.base, 0.7) }} />
          )}
          <span className="min-w-0 flex-1 truncate">{channel.name}</span>
          {channel.isPrivate ? <Lock className="h-3 w-3 shrink-0 text-slate-500" aria-label="Private channel" /> : null}
          {counts?.mentions ? (
            <span className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1.5 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]">@{counts.mentions}</span>
          ) : counts?.unread ? (
            <span className="rounded-full bg-sky-400/15 px-1.5 text-[10px] font-semibold text-sky-200">{counts.unread}</span>
          ) : null}
        </button>
      </li>
    );
  };

  const renderVoiceChannel = (channel: Channel) => (
    <li key={channel.id}>
      <button
        type="button"
        onClick={() => openChannel(channel)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.05] hover:text-slate-200",
          voiceSession?.channelId === channel.id ? "bg-emerald-500/15 text-emerald-100 shadow-[inset_2px_0_0_#34d399]" : "text-slate-400",
        )}
      >
        {channel.type === "STAGE" ? (
          <Radio className="h-3.5 w-3.5 shrink-0" style={{ color: hues.pink.base }} />
        ) : (
          <Volume2 className="h-3.5 w-3.5 shrink-0" style={{ color: hues.emerald.base }} />
        )}
        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
        {channel.isPrivate ? <Lock className="h-3 w-3 shrink-0 text-slate-500" aria-label="Private channel" /> : null}
        {voiceCounts[channel.id] ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300" title={`${voiceCounts[channel.id]} in voice`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {voiceCounts[channel.id]}
          </span>
        ) : null}
      </button>
    </li>
  );

  // Settings is about the person, not their servers or chats, so it shows only the main navigation.
  const quietWorkspace = pathname.startsWith("/app/settings");
  // In a server, the app's own navigation and header step back on desktop; the mobile menu keeps them (the server rail is hidden there).
  const serverView = useServerViewStore((state) => state.active);
  // Chat (servers, voice and messages) uses the whole content area; other pages keep a readable, centred width.
  const fullBleed = pathname.startsWith("/app/chat");
  // Channel list size and visibility (desktop). A list that doesn't fit the window steps aside without forgetting
  // the saved choice; the member list on the chat page counts towards that.
  const layoutPrefs = useLayoutPrefs();
  const viewportWidth = useViewportWidth();
  const setSidebarWidth = useLayoutStore((state) => state.setWidth);
  const toggleSidebar = useLayoutStore((state) => state.toggle);
  const [leftDraft, setLeftDraft] = useState<number | null>(null);
  const layout = effectiveLayout(layoutPrefs, viewportWidth || 1920, { hasLeft: true, hasRight: fullBleed && serverView });
  const leftWidth = leftDraft ?? layout.left;
  const leftMax = maxDragWidth("left", viewportWidth || 1920, layout.right);
  // The narrow-window case: the channel list opens over the page instead (like on a phone).
  const [sidebarOverlay, setSidebarOverlay] = useState(false);

  const renderSidebar = (width: number) => (
    <aside style={{ width }} className="flex h-full shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0e17]/85 backdrop-blur-xl">
      <div className={cn("relative p-3", quietWorkspace && "hidden")} ref={forgeMenuRef}>
        <button
          type="button"
          onClick={() => setForgeMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-110"
          style={{
            borderColor: alpha(hueFor(forge?.id ?? "vexora").base, 0.35),
            background: `linear-gradient(120deg, ${alpha(hueFor(forge?.id ?? "vexora").base, 0.18)}, rgba(17,21,30,0.9) 70%)`,
          }}
        >
          {forge?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={forge.icon} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-slate-950 shadow-[0_4px_14px_rgba(0,0,0,0.35)]" style={{ background: tileGradient(hueFor(forge?.id ?? "vexora")) }}>
              {initials(forge?.name ?? "Nexus Forge")}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {forge?.name ??
                (forgesQuery.isLoading || (selectedForgeId && !forgeQuery.isError)
                  ? "Loading your server…"
                  : forges.length
                    ? "Choose a server"
                    : "No server yet")}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Community server</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", forgeMenuOpen && "rotate-180")} />
        </button>
        {forgeMenuOpen ? (
          <div className="absolute inset-x-3 top-[calc(100%-4px)] z-40 max-h-72 overflow-y-auto rounded-xl border border-amber-500/25 bg-[#0d1119] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {forges.map((entry) => {
              const counts = forgeCounts[entry.id];
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectForge(entry.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5",
                    entry.id === selectedForgeId ? "text-amber-200" : "text-slate-200",
                  )}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-slate-950" style={{ background: tileGradient(hueFor(entry.id)) }}>{initials(entry.name)}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {counts?.unread ? <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-200">{counts.unread}</span> : null}
                </button>
              );
            })}
            {forge ? (
              <button
                type="button"
                onClick={() => void markRead(forge.id)}
                disabled={!forgeCounts[forge.id]?.unread && !forgeCounts[forge.id]?.mentions}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-300" /> Mark {forge.name} as read
              </button>
            ) : null}
            {forges.length > 1 ? (
              <button
                type="button"
                onClick={() => void markRead("all")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-300" /> Mark all servers as read
              </button>
            ) : null}
            {forge ? (
              <button
                type="button"
                onClick={() => {
                  setForgeMenuOpen(false);
                  setNotifyDialogOpen(true);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
              >
                {mutedForgeIds.has(forge.id) ? <BellOff className="h-3.5 w-3.5 text-violet-300" /> : <Bell className="h-3.5 w-3.5 text-sky-300" />}
                Notification settings for {forge.name}
              </button>
            ) : null}
            <Link href="/app/server" onClick={() => setForgeMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-amber-500/30 px-2 py-2 text-xs text-amber-200 hover:bg-amber-500/10">
              <Plus className="h-3.5 w-3.5" /> Create or join a forge
            </Link>
          </div>
        ) : null}
      </div>

      {serverView ? (
        <Link href="/app" onClick={() => setMobileOpen(false)} className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-white/[0.06] px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white">
          <Home className="h-4 w-4" /> Home
        </Link>
      ) : (
      <nav className="space-y-0.5 px-3">
        {navLinks.map((link, index) => {
          const active = isActive(pathname, link.href) || (link.matches ?? []).some((href) => isActive(pathname, href));
          const hue = hues[sectionHue[link.href] ?? "amber"];
          const startsGroup = index === 0 || navLinks[index - 1].group !== link.group;
          return (
            <Fragment key={link.href}>
            {startsGroup && link.group ? (
              <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{link.group}</p>
            ) : null}
            <Link
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border px-2 py-1.5 text-sm transition",
                active ? "text-white" : "border-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white",
              )}
              style={active ? { borderColor: alpha(hue.base, 0.45), background: `linear-gradient(90deg, ${alpha(hue.base, 0.2)}, ${alpha(hue.base, 0.03)})`, boxShadow: `0 0 18px ${alpha(hue.base, 0.12)}` } : undefined}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md transition group-hover:scale-105"
                style={{ background: alpha(hue.base, active ? 0.28 : 0.13), color: active ? hue.light : hue.base }}
              >
                <link.icon className="h-4 w-4" />
              </span>
              {link.label}
            </Link>
            </Fragment>
          );
        })}
      </nav>
      )}

      {serverView ? (
      <div className={cn("mt-4 flex-1 overflow-y-auto px-3 pb-3 no-scrollbar", quietWorkspace && "hidden")}>
        <div className="mb-1.5 flex items-center justify-between px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">Text channels</p>
          <Link href={selectedForgeId ? `/app/chat?forge=${selectedForgeId}&manage=channels` : "/app/chat"} className="text-slate-600 transition hover:text-amber-300" title="Add or manage channels">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="space-y-0.5">
          {looseText.map((channel) => renderTextChannel(channel))}
          {!textChannels.length && !forgeQuery.isLoading ? <li className="px-2 text-xs text-slate-600">No channels yet.</li> : null}
        </ul>

        {looseVoice.length || !categories.length ? (
          <>
            <p className="mb-1.5 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Voice channels</p>
            <ul className="space-y-0.5">{looseVoice.map((channel) => renderVoiceChannel(channel))}</ul>
          </>
        ) : null}

        {categories.map((category) => {
          const children = [...textChannels, ...voiceChannels].filter((channel) => channel.parentId === category.id).sort((a, b) => a.position - b.position);
          const collapsed = collapsedCategories.has(category.id);
          // Collapsed categories still show the channel you're in, like Discord.
          const visible = collapsed ? children.filter((channel) => channel.id === activeChannelId || voiceSession?.channelId === channel.id) : children;
          const unread = collapsed && children.some((channel) => channelCounts[channel.id]?.unread);
          return (
            <div key={category.id} className="mt-4">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-expanded={!collapsed}
                className={cn("mb-1 flex w-full items-center gap-1 px-1 text-left text-[10px] font-semibold uppercase tracking-[0.2em] transition hover:text-violet-200", unread ? "text-violet-100" : "text-violet-300/70")}
              >
                {collapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
              </button>
              <ul className="space-y-0.5">
                {visible.map((channel) => (channel.type === "VOICE" || channel.type === "STAGE" ? renderVoiceChannel(channel) : renderTextChannel(channel)))}
                {!collapsed && !children.length ? <li className="px-2 text-[11px] text-slate-600">Empty</li> : null}
              </ul>
            </div>
          );
        })}

        {forge ? (
          <div className="mt-5 rounded-lg border border-emerald-400/15 bg-gradient-to-r from-emerald-500/[0.08] to-sky-500/[0.05] px-3 py-2 text-[11px] text-slate-400">
            <span className="text-emerald-300">{onlineCount}</span> online · {forge.members.length} members
          </div>
        ) : null}
      </div>
      ) : null}

      {voiceSession ? (
        <div className="border-t border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/app/chat?forge=${voiceSession.forgeId ?? selectedForgeId ?? ""}&voice=${voiceSession.channelId}`} className="min-w-0">
              <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.16em]", voiceConnection === "connected" ? "text-emerald-300" : "text-amber-300")}>
                {voiceConnection === "connected" ? "Voice connected" : voiceConnection === "disconnected" ? "Voice disconnected" : "Connecting..."}
              </span>
              <span className="block truncate text-xs text-slate-300">{voiceSession.channelName} · {voiceRemote.length + 1} in call</span>
            </Link>
            <button type="button" onClick={leaveVoice} title="Leave voice" className="rounded-lg border border-white/10 p-1.5 text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
      <div className="border-t border-white/[0.06] bg-gradient-to-r from-violet-500/[0.08] via-[#0d1119] to-sky-500/[0.06] p-3">
        <div className="flex items-center gap-2.5">
          <Link href="/app/profile" className="relative shrink-0">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="h-9 w-9 rounded-full border border-amber-500/40 object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-slate-950" style={{ background: tileGradient(hueFor(user?.id)) }}>{initials(displayName)}</span>
            )}
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d1119]", presence.dot)} />
          </Link>
          <div className="relative min-w-0 flex-1" ref={statusMenuRef}>
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <button type="button" onClick={() => setStatusMenuOpen((open) => !open)} className={cn("flex max-w-full items-center gap-1 whitespace-nowrap text-[11px] hover:underline", presence.text)} title="Change status">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", presence.dot)} /> <span className="truncate">{presence.label}</span>
            </button>
            {statusMenuOpen ? (
              <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-44 rounded-xl border border-amber-500/25 bg-[#0d1119] p-1 shadow-xl">
                {(["ONLINE", "IDLE", "DND", "INVISIBLE"] as const).map((entry) => (
                  <button key={entry} type="button" onClick={() => void changeStatus(entry)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5", ownStatus === entry ? "text-amber-100" : "text-slate-200")}>
                    <span className={cn("h-2 w-2 rounded-full", presenceMeta[entry].dot)} />
                    <span>
                      {presenceMeta[entry].label}
                      {entry === "INVISIBLE" ? <span className="block text-[10px] text-slate-500">Appear offline</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {voiceSession ? (
            <button
              type="button"
              onClick={() => toggleVoice("muted")}
              className={cn("rounded-md p-1.5 transition hover:bg-white/5", voiceFlags.muted ? "text-rose-300" : "text-emerald-300")}
              title={voiceFlags.muted ? "Unmute" : "Mute"}
            >
              {voiceFlags.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          ) : (
            <Link href="/app/chat?voice=1" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white" title="Voice">
              <Mic className="h-4 w-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  // The bottom tab bar is for phones, and it stays off chat, where the message box needs the bottom of the screen.
  const showTabBar = !quietWorkspace && !pathname.startsWith("/app/chat");

  return (
    <div className="relative isolate flex h-app overflow-hidden bg-[#070a10] text-slate-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-[460px] w-[460px] rounded-full bg-cyan-500/[0.13] blur-[120px]" />
        <div className="absolute bottom-[-180px] left-1/3 h-[520px] w-[620px] rounded-full bg-fuchsia-600/[0.13] blur-[140px]" />
        <div className="absolute right-1/4 top-[-120px] h-[300px] w-[420px] rounded-full bg-amber-500/[0.08] blur-[110px]" />
      </div>
      <VoiceEngine />
      <PopoutHost />
      <AppearanceRuntime preferences={settingsQuery.data?.preferences} userId={user?.id ?? null} />
      <ConsentRenewal />
      <QuickSwitcher forges={forges} forge={forge} onSelectForge={(forgeId) => setSelectedForgeId(forgeId)} />
      <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
      {/* Onboarding belongs to Home. Servers and the other app pages do not carry it. */}
      <GetStartedPanel inviteCode={forge?.inviteCode ?? null} hidden={pathname !== "/app"} />
      <WhatsNewDialog />
      {forge ? <ForgeNotificationsDialog forgeId={forge.id} forgeName={forge.name} open={notifyDialogOpen} onClose={() => setNotifyDialogOpen(false)} /> : null}
      {serverMenu ? (
        <ServerContextMenu
          serverName={serverMenu.name}
          x={serverMenu.x}
          y={serverMenu.y}
          loading={serverMenu.loading}
          items={serverMenuItems({
            forgeId: serverMenu.forgeId,
            access: serverMenu.access,
            unread: Boolean(forgeCounts[serverMenu.forgeId]?.unread),
            mentions: Boolean(forgeCounts[serverMenu.forgeId]?.mentions),
          })}
          onSelect={runServerMenuItem}
          onClose={() => setServerMenu(null)}
        />
      ) : null}
      {/* Forge rail */}
      <div className={cn("hidden w-[60px] shrink-0 flex-col items-center gap-2 border-r border-white/[0.06] bg-[#080b12]/80 py-3 backdrop-blur-xl lg:flex", quietWorkspace && "lg:hidden")}>
        <Link href="/app" data-nf-logo className="mb-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-amber-500/40 shadow-[0_0_18px_rgba(46,164,255,0.25)]" title="Nexus Forge Gaming">
          <Image src="/brand/nexusforge-emblem-256.png" alt="Nexus Forge" width={40} height={40} className="h-10 w-10 object-cover" />
        </Link>
        <span className="mb-1 h-px w-8 bg-gradient-to-r from-violet-400/40 via-amber-400/50 to-cyan-400/40" />
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          {forges.map((entry) => {
            const counts = forgeCounts[entry.id];
            const active = entry.id === selectedForgeId && serverView;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectForge(entry.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openServerMenu(entry.id, entry.name, event.clientX, event.clientY);
                }}
                title={`${entry.name} (right-click for server menu)`}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center text-[11px] font-bold text-slate-950 transition-all duration-200",
                  active ? "rounded-[14px]" : "rounded-[20px] opacity-85 hover:rounded-[14px] hover:opacity-100",
                )}
                style={{
                  background: entry.icon ? undefined : tileGradient(hueFor(entry.id)),
                  boxShadow: active ? `0 0 0 2px #080b12, 0 0 0 4px ${hueFor(entry.id).base}, 0 0 18px ${alpha(hueFor(entry.id).base, 0.45)}` : undefined,
                }}
              >
                {entry.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.icon} alt="" className={cn("h-full w-full object-cover", active ? "rounded-[14px]" : "rounded-[20px]")} />
                ) : (
                  initials(entry.name)
                )}
                {counts?.mentions ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">{counts.mentions}</span>
                ) : counts?.unread && !mutedForgeIds.has(entry.id) ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080b12] bg-white" />
                ) : null}
                {mutedForgeIds.has(entry.id) ? (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#080b12] bg-slate-700 text-slate-200" title="Muted">
                    <BellOff className="h-2.5 w-2.5" />
                  </span>
                ) : null}
                {active ? <span className="absolute -left-[13px] h-7 w-1 rounded-r" style={{ background: hueFor(entry.id).base }} /> : null}
              </button>
            );
          })}
          <Link href="/app/server" className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-dashed border-emerald-400/40 text-emerald-300 transition-all hover:rounded-[14px] hover:bg-emerald-500/15" title="Create or join">
            <Plus className="h-4 w-4" />
          </Link>
          <span className="my-1 h-px w-8 bg-gradient-to-r from-violet-400/40 via-amber-400/50 to-cyan-400/40" />
          {railLinks.map((link) => {
            const active = isActive(pathname, link.href);
            const hue = hues[sectionHue[link.href] ?? "amber"];
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                aria-label={link.label}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition hover:scale-105"
                style={{ color: active ? hue.light : hue.base, background: alpha(hue.base, active ? 0.25 : 0.1), borderColor: active ? alpha(hue.base, 0.5) : "transparent" }}
              >
                <link.icon className="h-4 w-4" />
                {link.href === "/app/chat" && dmUnread ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{dmUnread > 99 ? "99+" : dmUnread}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            // Too narrow to dock it: open it over the page for now. Otherwise hide or show it and remember that.
            if (layout.leftAutoHidden) setSidebarOverlay(true);
            else toggleSidebar("left");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          title={layout.left ? "Hide the channel list" : layout.leftAutoHidden ? "Show the channel list (the window is too narrow to keep it open)" : "Show the channel list"}
          aria-label={layout.left ? "Hide the channel list" : "Show the channel list"}
          aria-pressed={Boolean(layout.left)}
        >
          {layout.left ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <Link href="/app/settings" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:text-amber-200" title="Settings">
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      {layout.left ? (
        <div className="hidden min-h-0 lg:flex">
          {renderSidebar(leftWidth)}
          <ResizeHandle
            label="Channel list width"
            edge="left"
            width={leftWidth}
            min={LAYOUT_LIMITS.left.min}
            max={leftMax}
            defaultWidth={LAYOUT_LIMITS.left.default}
            onResize={setLeftDraft}
            onCommit={(width) => {
              setLeftDraft(null);
              setSidebarWidth("left", width);
            }}
            onToggle={() => toggleSidebar("left")}
            className="-ml-1.5"
          />
        </div>
      ) : null}

      {mobileOpen || sidebarOverlay ? (
        <div role="dialog" aria-modal="true" aria-label="Navigation" className={cn("fixed inset-0 z-50 flex", !sidebarOverlay && "lg:hidden")}>
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              setMobileOpen(false);
              setSidebarOverlay(false);
            }}
          />
          <div className="relative flex h-full">{renderSidebar(LAYOUT_LIMITS.left.default)}</div>
        </div>
      ) : null}

      <main
        id="main-content"
        tabIndex={-1}
        className={cn("flex min-w-0 flex-1 flex-col", showTabBar && "pb-16 lg:pb-0")}
        style={(() => {
          const key = Object.keys(sectionHue)
            .filter((href) => pathname === href || (href !== "/app" && pathname.startsWith(href)))
            .sort((a, b) => b.length - a.length)[0] ?? "/app";
          const hue = hues[sectionHue[key] ?? "amber"];
          return { "--page-accent": hue.base, "--page-accent-light": hue.light } as React.CSSProperties;
        })()}
      >
        {serverView ? (
          // Inside a server the channel bar is the header; on phones only the menu stays, since the server rail is hidden there.
          <header className="relative flex h-14 shrink-0 items-center gap-3 bg-[#0b0e17]/75 px-3 backdrop-blur-xl lg:hidden">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300" title="Menu" aria-label="Open menu" aria-expanded={mobileOpen}>
              <Layers className="h-4 w-4" />
            </button>
          </header>
        ) : (
        <header className="relative flex h-14 shrink-0 items-center gap-3 bg-[#0b0e17]/75 px-3 backdrop-blur-xl md:px-5">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-violet-500/60 via-amber-400/70 via-50% to-cyan-400/60" />
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden" title="Menu" aria-label="Open menu" aria-expanded={mobileOpen}>
            <Layers className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("vexora:quick-switcher"))}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-violet-400/50 hover:text-white md:inline-flex"
            title="Quick switcher (Ctrl+K)"
          >
            Jump to <kbd className="rounded border border-white/10 px-1 text-[10px]">Ctrl K</kbd>
          </button>
          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Nexus Forge Gaming..."
              aria-label="Search Nexus Forge Gaming"
              className="h-9 w-full rounded-full border border-white/10 bg-[#11151e]/80 pl-9 pr-8 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-violet-400/60 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.15)]"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" title="Clear">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/app/friends" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-amber-200" title="Friends">
              <Users className="h-4 w-4" />
            </Link>
            <Link href="/app/updates" className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-violet-200" title="What's new" aria-label="What's new">
              <Megaphone className="h-4 w-4" />
              {hasUnseenUpdates ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-violet-400" /> : null}
            </Link>
            <button type="button" onClick={() => setSavedOpen(true)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-amber-200" title="Saved messages" aria-label="Saved messages">
              <Bookmark className="h-4 w-4" />
            </button>
            <Link href="/app/notifications" className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-amber-200" title="Notifications">
              <Bell className="h-4 w-4" />
              {unreadNotifications ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" /> : null}
            </Link>
            <Link href="/app/settings" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-amber-200" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
            <Link href="/app/profile" className="ml-1 flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#11151e] py-1 pl-1 pr-3 text-xs text-slate-200 transition hover:border-amber-400/60">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-100">{initials(displayName)}</span>
              )}
              <span className="hidden sm:inline">{displayName}</span>
            </Link>
          </div>
        </header>
        )}
        {user?.deletionScheduledFor ? (
          <div className="shrink-0 border-b border-rose-500/40 bg-rose-950/50 px-4 py-2 text-xs text-rose-100 md:px-6" role="alert">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-rose-500 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">Deletion scheduled</span>
              <span className="min-w-0 flex-1">
                Your account will be deleted on {new Date(user.deletionScheduledFor).toLocaleDateString(undefined, { dateStyle: "long" })}.
                {keepError ? <span className="ml-2 text-rose-300">{keepError}</span> : null}
              </span>
              <button
                type="button"
                disabled={keeping}
                onClick={async () => {
                  if (!accessToken || !csrfToken) return;
                  setKeeping(true);
                  setKeepError(null);
                  try {
                    await cancelAccountDeletion(accessToken, csrfToken);
                    await fetchMe();
                  } catch (error) {
                    setKeepError(getApiErrorMessage(error));
                  } finally {
                    setKeeping(false);
                  }
                }}
                className="rounded-lg border border-rose-300/50 bg-rose-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-rose-500/40 disabled:opacity-50"
              >
                {keeping ? "Keeping..." : "Keep my account"}
              </button>
            </div>
          </div>
        ) : null}
        {showProtectionBanner ? (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 md:px-6">
            <Link href="/app/settings?verify=1" className="flex flex-wrap items-center gap-2 hover:text-white">
              <span className="rounded bg-amber-400 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-950">Secure your account</span>
              {!protection?.emailVerified ? "Verify your email" : "Turn on two-factor sign-in"}
              <span className="hidden sm:inline"> so nobody can take over your account.</span>
              <span className="sm:hidden"> to secure it.</span> Open Settings →
            </Link>
          </div>
        ) : null}
        {/* Flex column so full-height pages (chat) can size to what is left under the header and banner. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Chat fills the area edge to edge (it sizes and scrolls its own panels); other pages are centred and padded. */}
          <div className={cn("w-full flex-1", fullBleed ? "flex min-h-0 flex-col" : "mx-auto max-w-[1400px] p-4 md:p-6")}>{children}</div>
        </div>
      </main>
      {showTabBar ? <MobileTabBar pathname={pathname} onMore={() => setMobileOpen(true)} /> : null}
    </div>
  );
}
