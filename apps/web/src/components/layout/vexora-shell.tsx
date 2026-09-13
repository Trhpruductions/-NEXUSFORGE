"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  ChevronDown,
  Compass,
  Hash,
  Home,
  Layers,
  LogOut,
  Megaphone,
  Mic,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getForge, getForgeUnreads, getProtectionStatus, getUnreadSummary, listForges, markChannelRead, type Channel } from "@/lib/api";
import { listNotifications } from "@/lib/notifications-api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const navLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Avatar Studio", href: "/app/avatar", icon: UserRound },
  { label: "Wardrobe", href: "/app/wardrobe", icon: Shirt },
  { label: "Profile", href: "/app/profile", icon: User },
  { label: "Community", href: "/app/server", icon: Layers },
  { label: "Discover", href: "/app/discover", icon: Compass },
  { label: "Events", href: "/app/events", icon: Calendar },
  { label: "Store", href: "/app/store", icon: ShoppingBag },
  { label: "Settings", href: "/app/settings", icon: Settings },
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

export function VexoraShell({ children }: { children: ReactNode }) {
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
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
  const textChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "TEXT" || channel.type === "ANNOUNCEMENT"), [forge]);
  const voiceChannels = useMemo(() => (forge?.channels ?? []).filter((channel) => channel.type === "VOICE" || channel.type === "STAGE"), [forge]);
  const onlineCount = useMemo(() => (forge?.members ?? []).filter((member) => member.user.status !== "OFFLINE").length, [forge]);

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
  const protection = protectionQuery.data?.protection;
  const showProtectionBanner = Boolean(protection && !protection.complete && !pathname.startsWith("/app/settings"));

  // Join every forge room so unread badges tick live, even for forges not currently open.
  useEffect(() => {
    if (!accessToken || !forges.length) return;
    const socket = getSocket(accessToken);
    if (!socket.connected) socket.connect();
    const join = () => forges.forEach((entry) => socket.emit("forge:join", entry.id));
    join();

    const handleActivity = (payload: { forgeId: string; channelId: string; authorId: string; mentionedUserIds?: string[] }) => {
      if (payload.authorId === user?.id) return;
      const mentioned = Boolean(user?.id && payload.mentionedUserIds?.includes(user.id));
      bumpChannel(payload.forgeId, payload.channelId, mentioned);
    };
    const handleChannels = (payload: { forgeId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["forge", payload.forgeId, accessToken] });
    };
    const handlePresence = (payload: { forgeId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["forge", payload.forgeId, accessToken] });
    };

    socket.on("connect", join);
    socket.on("channel:activity", handleActivity);
    socket.on("forge:channels", handleChannels);
    socket.on("presence:changed", handlePresence);
    return () => {
      socket.off("connect", join);
      socket.off("channel:activity", handleActivity);
      socket.off("forge:channels", handleChannels);
      socket.off("presence:changed", handlePresence);
    };
  }, [accessToken, forges, user?.id, bumpChannel, queryClient]);

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
    if (accessToken && csrfToken) void markChannelRead(accessToken, csrfToken, channel.id).catch(() => undefined);
    setMobileOpen(false);
    const param = channel.type === "VOICE" || channel.type === "STAGE" ? "voice" : "channel";
    router.push(`/app/chat?forge=${selectedForgeId}&${param}=${channel.id}`);
  };

  const selectForge = (forgeId: string) => {
    setSelectedForgeId(forgeId);
    setForgeMenuOpen(false);
    if (pathname.startsWith("/app/chat")) router.push(`/app/chat?forge=${forgeId}`);
  };

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!search.trim()) return;
    router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  const displayName = user?.displayName || user?.username || "Member";

  const sidebar = (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-amber-500/15 bg-[#0b0e15]">
      <div className="relative p-3" ref={forgeMenuRef}>
        <button
          type="button"
          onClick={() => setForgeMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-500/25 bg-[#11151e] px-3 py-2.5 text-left transition hover:border-amber-400/50"
        >
          {forge?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={forge.icon} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-700 text-xs font-bold text-slate-950">
              {initials(forge?.name ?? "Vexora")}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{forge?.name ?? (forgesQuery.isLoading ? "Loading..." : "No forge yet")}</span>
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
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-[10px] font-bold">{initials(entry.name)}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {counts?.unread ? <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-200">{counts.unread}</span> : null}
                </button>
              );
            })}
            <Link href="/app/server" onClick={() => setForgeMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-amber-500/30 px-2 py-2 text-xs text-amber-200 hover:bg-amber-500/10">
              <Plus className="h-3.5 w-3.5" /> Create or join a forge
            </Link>
          </div>
        ) : null}
      </div>

      <nav className="space-y-0.5 px-3">
        {navLinks.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                active
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-100 shadow-[inset_0_0_0_1px_rgba(230,179,37,0.2)]"
                  : "border-transparent text-slate-300 hover:border-white/5 hover:bg-white/[0.03] hover:text-white",
              )}
            >
              <link.icon className={cn("h-4 w-4", active ? "text-amber-300" : "text-slate-500")} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3 pb-3 no-scrollbar">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Text channels</p>
          <Link href="/app/chat" className="text-slate-600 transition hover:text-amber-300" title="Manage channels">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="space-y-0.5">
          {textChannels.map((channel) => {
            const counts = channelCounts[channel.id];
            const active = activeChannelId === channel.id;
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => openChannel(channel)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                    active ? "bg-amber-500/10 text-amber-100" : counts?.unread ? "text-white hover:bg-white/[0.04]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                  )}
                >
                  {channel.type === "ANNOUNCEMENT" ? <Megaphone className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : <Hash className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
                  <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  {counts?.mentions ? (
                    <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">@{counts.mentions}</span>
                  ) : counts?.unread ? (
                    <span className="text-xs font-semibold text-amber-300">{counts.unread}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {!textChannels.length && !forgeQuery.isLoading ? <li className="px-2 text-xs text-slate-600">No channels yet.</li> : null}
        </ul>

        <p className="mb-1.5 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Voice channels</p>
        <ul className="space-y-0.5">
          {voiceChannels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                onClick={() => openChannel(channel)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                {channel.type === "STAGE" ? <Radio className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : <Volume2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
              </button>
            </li>
          ))}
        </ul>

        {forge ? (
          <div className="mt-5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500">
            <span className="text-emerald-300">{onlineCount}</span> online · {forge.members.length} members
          </div>
        ) : null}
      </div>

      <div className="border-t border-amber-500/15 bg-[#0d1119] p-3">
        <div className="flex items-center gap-2.5">
          <Link href="/app/profile" className="relative shrink-0">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="h-9 w-9 rounded-full border border-amber-500/40 object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/40 bg-slate-800 text-xs font-bold text-amber-100">{initials(displayName)}</span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d1119] bg-emerald-400" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="flex items-center gap-1 text-[11px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </p>
          </div>
          <Link href="/app/chat?voice=1" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white" title="Voice">
            <Mic className="h-4 w-4" />
          </Link>
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

  return (
    <div className="flex h-dvh overflow-hidden bg-[#070a10] text-slate-100">
      {/* Forge rail */}
      <div className="hidden w-[60px] shrink-0 flex-col items-center gap-2 border-r border-amber-500/15 bg-[#080b12] py-3 lg:flex">
        <Link href="/app" className="mb-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-amber-500/40 shadow-[0_0_18px_rgba(230,179,37,0.25)]" title="Vexora Gaming">
          <Image src="/brand/vexora-mark-gold-256.png" alt="Vexora" width={40} height={40} className="h-10 w-10 object-cover" />
        </Link>
        <span className="mb-1 h-px w-8 bg-amber-500/25" />
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          {forges.map((entry) => {
            const counts = forgeCounts[entry.id];
            const active = entry.id === selectedForgeId;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectForge(entry.id)}
                title={entry.name}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-bold transition",
                  active ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-white/10 bg-slate-900 text-slate-300 hover:border-amber-400/50 hover:text-white",
                )}
              >
                {entry.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.icon} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  initials(entry.name)
                )}
                {counts?.mentions ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{counts.mentions}</span>
                ) : counts?.unread ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080b12] bg-amber-400" />
                ) : null}
                {active ? <span className="absolute -left-[13px] h-6 w-1 rounded-r bg-amber-400" /> : null}
              </button>
            );
          })}
          <Link href="/app/server" className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-amber-500/30 text-amber-300 transition hover:bg-amber-500/10" title="Create or join">
            <Plus className="h-4 w-4" />
          </Link>
          <Link href="/app/discover" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-amber-400/50 hover:text-amber-200" title="Discover">
            <Compass className="h-4 w-4" />
          </Link>
        </div>
        <Link href="/app/settings" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:text-amber-200" title="Settings">
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      <div className="hidden lg:flex">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full">{sidebar}</div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-amber-500/15 bg-[#0b0e15]/90 px-3 backdrop-blur md:px-5">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden" title="Menu">
            <Layers className="h-4 w-4" />
          </button>
          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${forge?.name ?? "Vexora Gaming"}...`}
              className="h-9 w-full rounded-full border border-white/10 bg-[#11151e] pl-9 pr-8 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60"
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {showProtectionBanner ? (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 md:px-6">
              <Link href="/app/settings?verify=1" className="flex flex-wrap items-center gap-2 hover:text-white">
                <span className="rounded bg-amber-400 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-950">Secure your account</span>
                {!protection?.emailVerified ? "Verify your email" : !protection?.phoneVerified ? "Add and verify a phone number" : "Turn on two-factor sign-in"} so nobody can take over your account. Open Settings →
              </Link>
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
