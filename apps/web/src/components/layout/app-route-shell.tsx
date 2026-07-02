"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppLeftDock } from "@/components/layout/app-left-dock";
import { useAuthStore } from "@/store/auth-store";
import { 
  Activity, 
  Bell, 
  CloudDownload, 
  Gamepad, 
  Heart, 
  Home, 
  Layers, 
  Sparkles, 
  User, 
  Coins, 
  TrendingUp, 
  Cpu, 
  Gem, 
  Star, 
  Database, 
  Radio,
  MessageSquare,
  Settings,
  LogOut,
  SlidersHorizontal
} from "lucide-react";
import { SecurityGuard } from "@/components/tactical/security-guard";
import { LiveTacticalLog } from "@/components/tactical/live-log";

const navLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Live Now", href: "/app/live", icon: Radio },
  { label: "Community", href: "/app/server", icon: Layers },
  { label: "Chat", href: "/app/chat", icon: MessageSquare },
  { label: "Listen", href: "/app/friends", icon: Heart },
  { label: "Games", href: "/app/games", icon: Gamepad },
  { label: "Mining", href: "/app/mining", icon: Cpu },
  { label: "Activity", href: "/app/activity", icon: Activity },
  { label: "Vault", href: "/app/rewards", icon: Database },
  { label: "Downloads", href: "/app/downloads", icon: CloudDownload },
  { label: "Notifications", href: "/app/notifications", icon: Bell },
  { label: "Profile", href: "/app/profile", icon: User },
];

function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/app" && pathname?.startsWith(href));
}

const routeMeta = [
  {
    match: (pathname: string) => pathname === "/app",
    title: "Workspace Home",
    subtitle: "High-signal command view for squads, creators, and competitive sessions.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/server"),
    title: "Communities",
    subtitle: "Run your core servers with less clutter and faster operational decisions.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/chat"),
    title: "Chat",
    subtitle: "Real-time team chat and moderation workflows tuned for serious play.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/friends"),
    title: "Voice",
    subtitle: "Low-friction voice control built for stacked lobbies and late-night sessions.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/games"),
    title: "Games",
    subtitle: "Launch, track, and optimize sessions without losing tactical context.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/mining"),
    title: "Mining",
    subtitle: "Monitor output, upgrades, and yield with production-grade visibility.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/live"),
    title: "Live",
    subtitle: "Track active matches and live events in a command-ready timeline.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/activity"),
    title: "Activity",
    subtitle: "Operational history and incident visibility without notification fatigue.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/rewards"),
    title: "Rewards",
    subtitle: "Manage progression, unlocks, and economy gains with full traceability.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/downloads"),
    title: "Downloads",
    subtitle: "Ship updates fast and keep every device release-aligned.",
  },
];

function IntegrityBar({ value, color }: { value: string; color: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      const width = value.includes("%") ? value : "100%";
      barRef.current.style.width = width;
    }
  }, [value]);

  return (
    <div className="integrity-bar h-1 bg-slate-900/5 relative overflow-hidden">
      <div ref={barRef} className={cn("h-full transition-all duration-700", color)} />
    </div>
  );
}

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const { user, clearSession } = useAuthStore();
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);

  const routeInfo = useMemo(
    () => routeMeta.find((route) => route.match(pathname)) ?? routeMeta[0],
    [pathname]
  );

  const members = [
    { name: "ShadowByte", status: "online", activity: "Deploying Nexus v2", color: "text-amber-500" },
    { name: "NexusPrime", status: "online", activity: "Monitoring Grid", color: "text-emerald-500" },
    { name: "GhostProtocol", status: "offline", activity: "Hidden", color: "text-slate-500" },
  ];

  useEffect(() => {
    if (!settingsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setSettingsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [settingsMenuOpen]);

  const handleSignOut = () => {
    clearSession();
    setSettingsMenuOpen(false);
    router.push("/login");
  };

  return (
    <div className="relative min-h-dvh h-dvh overflow-hidden bg-[radial-gradient(circle_at_10%_10%,rgba(251,113,133,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(251,191,36,0.16),transparent_26%),linear-gradient(164deg,#04030a,#120a14_50%,#07080f)] text-slate-100 nf-content-rhythm">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-20" />
      <div className="mx-auto flex h-full">
        <AppLeftDock />
        
        <aside className="hidden lg:flex w-[210px] xl:w-[230px] 2xl:w-[250px] h-dvh flex-col border-r border-amber-500/25 bg-slate-950/72 backdrop-blur-3xl z-40 transition-all duration-500 nf-motion-rise nf-delay-40">
          <div className="flex h-[64px] shrink-0 items-center px-6 border-b border-slate-700/70 bg-slate-900/55">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]" />
              <h2 className="nf-heading text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200">Nexus Hub</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-8 space-y-10 no-scrollbar">
            <div>
              <p className="px-6 mb-4 nf-type-eyebrow text-slate-400 opacity-90">Core navigation</p>
              <div className="space-y-1">
                {navLinks.slice(0, 6).map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all text-left group nf-interact",
                        active && "text-slate-100 bg-[linear-gradient(90deg,rgba(251,113,133,0.24),rgba(15,23,42,0.0))] border-r-2 border-amber-300"
                      )}
                    >
                      <link.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active && "text-amber-200")} />
                      <span className="nf-nav-label">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-6 mb-4 nf-type-eyebrow text-slate-400 opacity-90">Quick links</p>
              <div className="space-y-1">
                {[
                  { label: "Community", href: "/app/server", tag: "COM" },
                  { label: "Chat", href: "/app/chat", tag: "CHT" },
                  { label: "Vault", href: "/app/rewards", tag: "VAU" },
                  { label: "Alerts", href: "/app/notifications", tag: "ALT" },
                ].map((node) => {
                  const active = pathname === node.href;
                  return (
                    <Link
                      key={node.label}
                      href={node.href}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all text-left group nf-interact",
                        active && "text-slate-100 bg-[linear-gradient(90deg,rgba(244,63,94,0.22),rgba(15,23,42,0.0))] border-r-2 border-rose-400"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 flex items-center justify-center text-[8px] font-semibold border transition-all",
                        active ? "border-amber-300/70 bg-rose-500/20 text-amber-100 shadow-sm" : "border-slate-700/70 bg-slate-900 group-hover:border-slate-500/60"
                      )}>
                        {node.tag}
                      </div>
                      <span className="nf-nav-label">{node.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-slate-700/70 bg-slate-900/55">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700/70 flex items-center justify-center text-slate-100 font-semibold text-sm shadow-sm">
                {user?.username?.substring(0,2).toUpperCase() || "NF"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-semibold text-slate-100 uppercase tracking-wider truncate">{user?.username || "Member"}</span>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-tighter opacity-80">Verified account</span>
              </div>
              <button 
                onClick={() => clearSession()}
                className="ml-auto p-2 text-slate-500 hover:text-slate-100 transition-all hover:scale-110"
                title="Disconnect"
              >
                <Activity className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 h-dvh overflow-hidden flex flex-col relative bg-transparent min-w-0 nf-motion-rise nf-delay-120">
          <header className="h-[64px] shrink-0 border-b border-amber-500/25 flex items-center justify-between px-4 md:px-6 xl:px-8 2xl:px-10 bg-slate-950/65 backdrop-blur-xl z-30">
            <div className="flex items-center gap-3 md:gap-8 min-w-0">
              <div className="hidden md:flex items-center gap-3 text-amber-200 font-semibold text-[11px] uppercase tracking-[0.24em]">
                Command Network <span className="text-slate-100 tracking-[0.1em] opacity-90">{routeInfo.title}</span>
              </div>
              <div className="hidden md:block h-4 w-px bg-slate-300/40" />
              <SecurityGuard status="SECURED" clearance={user?.appRole || "USER"} />
            </div>

            <div className="flex items-center gap-2 md:gap-6">
              <div className="flex items-center gap-2 md:gap-3">
                 {/* Premium currencies compact view */}
                  <div className="hidden 2xl:flex items-center gap-6 mr-4 border-r border-slate-700/70 pr-6">
                    <div className="flex flex-col items-end gap-0.5" title="Aether Crystals">
                       <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-nexus-purple drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                            <span className="text-[10px] font-semibold text-slate-100 tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'AC')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                            <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-widest opacity-60">Aether</span>
                    </div>

                    <div className="flex flex-col items-end gap-0.5" title="Forge Shards">
                       <div className="flex items-center gap-1.5">
                          <Gem className="w-3 h-3 text-nexus-cyan drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]" />
                            <span className="text-[10px] font-semibold text-slate-100 tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'FS')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                            <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-widest opacity-60">Shards</span>
                    </div>

                    <div className="flex flex-col items-end gap-0.5" title="Forge Reputation">
                       <div className="flex items-center gap-1.5">
                          <Star className="w-3 h-3 text-nexus-crimson drop-shadow-[0_0_5px_rgba(255,46,77,0.5)]" />
                           <span className="text-[10px] font-semibold text-slate-100 tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'FR')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                           <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-widest opacity-60">Reputation</span>
                    </div>
                 </div>

                  <div className="hidden sm:flex flex-col items-end gap-1">
                        <div className="group relative flex items-center gap-4 overflow-hidden rounded-full border border-amber-500/30 bg-slate-950/85 py-2 px-4 lg:px-6">
                          <div className="absolute inset-0 bg-sky-300/5 translate-x-[-100%] transition-transform duration-1000 group-hover:translate-x-[100%]" />
                          <Coins className="h-4 w-4 text-amber-200" />
                           <span className="text-[13px] font-semibold text-slate-100 tabular-nums tracking-widest">
                         {Number(user?.economyAccounts?.find(a => a.currencyType === 'NC')?.balance || 0).toLocaleString()} 
                             <span className="ml-2 text-[10px] font-semibold text-slate-400">NC</span>
                       </span>
                    </div>
                        <span className="text-[7px] font-semibold text-slate-500 tracking-[0.3em] uppercase">
                           Credit line
                    </span>
                 </div>
              </div>
              <button 
                title="Notifications"
                                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-700/70 text-slate-400 transition-all hover:border-amber-400/60 hover:text-amber-200 nf-interact"
              >
                <Bell className="w-5 h-5" />
              </button>
              <div className="relative" ref={settingsMenuRef}>
                <button
                  type="button"
                  title="Settings"
                  aria-label="Open settings menu"
                  aria-haspopup="menu"
                  onClick={() => setSettingsMenuOpen((current) => !current)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-700/70 text-slate-400 transition-all hover:border-rose-400/60 hover:text-rose-300 nf-interact"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {settingsMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-[16px] border border-slate-700/70 bg-slate-950/95 p-2 shadow-[0_24px_48px_rgba(2,6,23,0.45)]" role="menu" aria-label="Settings options">
                    <Link
                      href="/app/settings"
                      onClick={() => setSettingsMenuOpen(false)}
                      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/70"
                      role="menuitem"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                      App Settings
                    </Link>
                    <Link
                      href="/app/profile"
                      onClick={() => setSettingsMenuOpen(false)}
                      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/70"
                      role="menuitem"
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      Profile
                    </Link>
                    <Link
                      href="/app/notifications"
                      onClick={() => setSettingsMenuOpen(false)}
                      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/70"
                      role="menuitem"
                    >
                      <Bell className="h-4 w-4 text-slate-500" />
                      Notification Controls
                    </Link>
                    <Link
                      href="/app/downloads"
                      onClick={() => setSettingsMenuOpen(false)}
                      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/70"
                      role="menuitem"
                    >
                      <CloudDownload className="h-4 w-4 text-slate-500" />
                      Downloads
                    </Link>
                    <div className="my-1 h-px bg-slate-700" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/15"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 xl:p-8 2xl:p-10">
            <div className="w-full mx-auto nf-motion-rise nf-delay-180">
                  <div className="mb-4 space-y-1.5 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 backdrop-blur-md lg:hidden">
                    <p className="nf-type-eyebrow text-amber-300">{routeInfo.title}</p>
                    <p className="nf-type-subtitle text-slate-400">{routeInfo.subtitle}</p>
              </div>
              {children}
            </div>
          </div>
        </main>

            <aside className="hidden 2xl:flex w-[250px] h-dvh flex-col border-l border-slate-700/70 bg-slate-950/60 backdrop-blur-3xl z-40 transition-all duration-500 nf-motion-rise nf-delay-220">
              <div className="flex h-[64px] shrink-0 items-center px-8 border-b border-slate-700/70 bg-slate-900/50">
                <h2 className="nf-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Overview</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.35em] text-slate-500">System pulse</p>
                    <TrendingUp className="h-3 w-3 text-amber-500" />
              </div>
              <div className="space-y-6">
                {[
                      { label: "Health", value: "98.4%", color: "bg-emerald-500" },
                      { label: "Sync", value: "Stable", color: "bg-emerald-500" },
                      { label: "Load", value: "12.4%", color: "bg-amber-500" },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest">
                          <span className="text-slate-500 nf-type-eyebrow">{stat.label}</span>
                      <span className={stat.color.replace('bg-', 'text-')}>{stat.value}</span>
                    </div>
                    <IntegrityBar value={stat.value} color={stat.color} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.35em] text-slate-500">People online</p>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.name} className="group flex items-center gap-5 border border-transparent p-2 transition-all hover:border-slate-600/60 hover:bg-slate-900/60">
                    <div className="relative shrink-0">
                      <div className={cn("flex h-10 w-10 items-center justify-center border border-slate-700/70 bg-slate-900 text-[10px] font-semibold text-slate-300", member.color)}>
                        {member.name.substring(0,2).toUpperCase()}
                      </div>
                      {member.status === "online" && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-slate-100">{member.name}</span>
                      <span className="mt-1 truncate text-[8px] font-semibold uppercase text-slate-500">{member.activity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.35em] text-slate-500">Event stream</p>
              <LiveTacticalLog />
            </div>
          </div>

           <div className="border-t border-slate-700/70 bg-slate-900/60 p-8">
             <div className="space-y-3 rounded-2xl border border-amber-500/35 bg-amber-950/25 p-6">
               <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Safety note</p>
               <p className="text-[9px] leading-relaxed uppercase font-medium text-amber-100/80">
                   Persistent sessions stay protected.<br/>
                   Activity remains auditable.<br/>
                   Connections are encrypted.
                </p>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
