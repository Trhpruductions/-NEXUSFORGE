"use client";

import { useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Radio
} from "lucide-react";
import { SecurityGuard } from "@/components/tactical/security-guard";
import { LiveTacticalLog } from "@/components/tactical/live-log";

const navLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Live Now", href: "/app/live", icon: Radio },
  { label: "Community", href: "/app/server", icon: Layers },
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
    title: "Central_Dashboard",
    subtitle: "Navigate the Nexus. Access active nodes, monitor live social feeds, and deploy systems.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/server"),
    title: "Tactical_Communities",
    subtitle: "Join industrial-grade social clusters and community-driven server nodes.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/friends"),
    title: "Audio_Link",
    subtitle: "Synchronized audio streams and tactical voice communication layers.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/games"),
    title: "Launch_Arena",
    subtitle: "High-performance game launching and competitive match tracking.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/mining"),
    title: "Mining_Infrastructure",
    subtitle: "Monitor rig throughput, thermal load, and harvest operations in real time.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/live"),
    title: "Live_Operations",
    subtitle: "Track live signals, events, and active operational feeds.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/activity"),
    title: "System_Logs",
    subtitle: "Real-time activity audit, event telemetry, and decentralized alert feeds.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/rewards"),
    title: "Asset_Vault",
    subtitle: "Claim tactical badges, XP credits, and localized digital currency.",
  },
  {
    match: (pathname: string) => pathname.startsWith("/app/downloads"),
    title: "Deployment_Channel",
    subtitle: "Access desktop build channels, package integrity, and release downloads.",
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
    <div className="integrity-bar h-1 bg-white/5 relative overflow-hidden">
      <div ref={barRef} className={cn("h-full transition-all duration-700", color)} />
    </div>
  );
}

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const { user, clearSession } = useAuthStore();

  const routeInfo = useMemo(
    () => routeMeta.find((route) => route.match(pathname)) ?? routeMeta[0],
    [pathname]
  );

  const members = [
    { name: "ShadowByte", status: "online", activity: "Deploying Nexus v2", color: "text-amber-500" },
    { name: "NexusPrime", status: "online", activity: "Monitoring Grid", color: "text-emerald-500" },
    { name: "GhostProtocol", status: "offline", activity: "Hidden", color: "text-slate-500" },
  ];

  return (
    <div className="relative min-h-dvh h-dvh overflow-hidden bg-black text-foreground">
      <div className="mx-auto flex h-full">
        <AppLeftDock />
        
        <aside className="hidden lg:flex w-[210px] xl:w-[230px] 2xl:w-[250px] h-dvh flex-col border-r border-white/10 bg-black/90 backdrop-blur-3xl z-40 transition-all duration-500">
          <div className="flex h-[64px] shrink-0 items-center px-6 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-nexus-cyan animate-pulse shadow-[0_0_12px_rgba(0,242,255,0.8)]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-nexus-cyan nexus-text-vibrant">Nexus_Hub</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-8 space-y-10 no-scrollbar">
            <div>
              <p className="px-6 mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-nexus-purple opacity-90">Core_Systems</p>
              <div className="space-y-1">
                {navLinks.slice(0, 5).map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-left group",
                        active && "text-nexus-gold bg-nexus-gold/5 border-r-2 border-nexus-gold nexus-text-pop"
                      )}
                    >
                      <link.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active && "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]")} />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em]">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-6 mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-nexus-purple opacity-90">Operations</p>
              <div className="space-y-1">
                {[
                  { label: "Community", href: "/app/server", tag: "COM" },
                  { label: "Vault", href: "/app/rewards", tag: "VAU" },
                  { label: "Alerts", href: "/app/notifications", tag: "ALT" },
                ].map((node) => {
                  const active = pathname === node.href;
                  return (
                    <Link
                      key={node.label}
                      href={node.href}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-left group",
                        active && "text-nexus-gold bg-nexus-gold/5 border-r-2 border-nexus-gold nexus-text-pop"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 flex items-center justify-center text-[8px] font-black border transition-all",
                        active ? "border-nexus-gold bg-nexus-gold text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]" : "border-white/10 group-hover:border-white/30"
                      )}>
                        {node.tag}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em]">{node.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 border border-nexus-gold/30 flex items-center justify-center text-nexus-gold font-black text-sm shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                {user?.username?.substring(0,2).toUpperCase() || "NF"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{user?.username || "Commander"}</span>
                <span className="text-[9px] font-mono text-nexus-cyan font-bold tracking-tighter uppercase opacity-80">Verified_Agent</span>
              </div>
              <button 
                onClick={() => clearSession()}
                className="ml-auto p-2 text-slate-500 hover:text-nexus-crimson transition-all hover:scale-110"
                title="Disconnect"
              >
                <Activity className="w-5 h-5 drop-shadow-[0_0_8px_rgba(255,46,77,0.3)]" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 h-dvh overflow-hidden flex flex-col relative bg-[#02060c] min-w-0">
          <header className="h-[64px] shrink-0 border-b border-white/10 flex items-center justify-between px-4 md:px-6 xl:px-8 2xl:px-10 bg-black/80 backdrop-blur-xl z-30">
            <div className="flex items-center gap-3 md:gap-8 min-w-0">
              <div className="hidden md:flex items-center gap-3 text-nexus-gold font-black text-[11px] uppercase tracking-[0.5em] nexus-text-pop">
                Protocol <span className="text-white tracking-[0.2em] opacity-80">{routeInfo.title.toUpperCase()}</span>
              </div>
              <div className="hidden md:block h-4 w-px bg-white/10" />
              <SecurityGuard status="SECURED" clearance={user?.appRole || "USER"} />
            </div>

            <div className="flex items-center gap-2 md:gap-6">
              <div className="flex items-center gap-2 md:gap-3">
                 {/* Premium currencies compact view */}
                 <div className="hidden 2xl:flex items-center gap-6 mr-4 border-r border-white/10 pr-6">
                    <div className="flex flex-col items-end gap-0.5" title="Aether Crystals">
                       <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-nexus-purple drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                          <span className="text-[10px] font-black text-white tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'AC')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                       <span className="text-[7px] font-black text-nexus-purple uppercase tracking-widest opacity-60">AETHER</span>
                    </div>

                    <div className="flex flex-col items-end gap-0.5" title="Forge Shards">
                       <div className="flex items-center gap-1.5">
                          <Gem className="w-3 h-3 text-nexus-cyan drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]" />
                          <span className="text-[10px] font-black text-white tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'FS')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                       <span className="text-[7px] font-black text-nexus-cyan uppercase tracking-widest opacity-60">SHARDS</span>
                    </div>

                    <div className="flex flex-col items-end gap-0.5" title="Forge Reputation">
                       <div className="flex items-center gap-1.5">
                          <Star className="w-3 h-3 text-nexus-crimson drop-shadow-[0_0_5px_rgba(255,46,77,0.5)]" />
                          <span className="text-[10px] font-black text-white tabular-nums">
                            {Number(user?.economyAccounts?.find(a => a.currencyType === 'FR')?.balance || 0).toLocaleString()}
                          </span>
                       </div>
                       <span className="text-[7px] font-black text-nexus-crimson uppercase tracking-widest opacity-60">REPUTATION</span>
                    </div>
                 </div>

                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 py-2 px-4 lg:px-6 nexus-corner-tick relative overflow-hidden group">
                       <div className="absolute inset-0 bg-amber-500/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                       <Coins className="w-4 h-4 text-amber-500" />
                       <span className="text-[13px] font-black text-white tabular-nums tracking-widest">
                         {Number(user?.economyAccounts?.find(a => a.currencyType === 'NC')?.balance || 0).toLocaleString()} 
                         <span className="text-[10px] text-slate-500 font-mono ml-2">NC</span>
                       </span>
                    </div>
                    <span className="text-[7px] font-mono text-slate-700 tracking-[0.3em] uppercase">
                       INDUSTRIAL_CREDIT_LINE
                    </span>
                 </div>
              </div>
              <button 
                title="Notifications"
                className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-amber-500/50 transition-all text-slate-500 hover:text-white"
              >
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 xl:p-8 2xl:p-10">
            <div className="w-full mx-auto animate-in fade-in duration-300">
              <div className="lg:hidden mb-4 p-4 border border-white/10 bg-black/40 backdrop-blur-md space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-nexus-gold">{routeInfo.title}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-relaxed">{routeInfo.subtitle}</p>
              </div>
              {children}
            </div>
          </div>
        </main>

        <aside className="hidden 2xl:flex w-[250px] h-dvh flex-col border-l border-white/5 bg-black/80 backdrop-blur-3xl z-40 transition-all duration-500">
          <div className="flex h-[64px] shrink-0 items-center px-8 border-b border-white/5 bg-white/2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Diagnostics</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Telemetry_Pulse</p>
                <TrendingUp className="w-3 h-3 text-amber-500" />
              </div>
              <div className="space-y-6">
                {[
                  { label: "Shield_Phase", value: "98.4%", color: "bg-emerald-500" },
                  { label: "Core_Sync", value: "STABLE", color: "bg-emerald-500" },
                  { label: "Kernel_Load", value: "12.4%", color: "bg-amber-500" },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-500">{stat.label}</span>
                      <span className={stat.color.replace('bg-', 'text-')}>{stat.value}</span>
                    </div>
                    <IntegrityBar value={stat.value} color={stat.color} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Active_Link_Nodes</p>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.name} className="flex items-center gap-5 group p-2 border border-transparent hover:border-white/5 hover:bg-white/2 transition-all">
                    <div className="relative shrink-0">
                      <div className={cn("w-10 h-10 flex items-center justify-center border border-white/10 text-[10px] font-black", member.color)}>
                        {member.name.substring(0,2).toUpperCase()}
                      </div>
                      {member.status === "online" && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-black text-white uppercase tracking-widest truncate">{member.name}</span>
                      <span className="text-[8px] font-mono text-slate-500 uppercase mt-1 truncate">{member.activity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Event_Stream</p>
              <LiveTacticalLog />
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-black">
             <div className="p-6 border border-amber-500/20 bg-amber-500/5 space-y-3">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Industrial_Security_Manifest</p>
                <p className="text-[9px] text-amber-500/40 uppercase font-mono leading-relaxed">
                   Persistence: [HARDENED]<br/>
                   Integrity: [VALIDATED]<br/>
                   Network: [ENCRYPTED]
                </p>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
