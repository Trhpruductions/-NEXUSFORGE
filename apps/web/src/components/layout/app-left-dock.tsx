"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appServerLinks } from "@/lib/app-servers";
import { cn } from "@/lib/utils";
import { Plus, Compass, Coins } from "lucide-react";

export function AppLeftDock({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/app";

  return (
    <nav className={cn("flex h-dvh w-[64px] flex-col items-center gap-4 border-r border-amber-500/30 bg-[linear-gradient(180deg,rgba(6,4,10,0.95),rgba(14,8,16,0.82))] py-4 text-slate-100 shadow-[0_28px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl md:w-[80px] md:py-6", className)} aria-label="Nexus navigation dock">
      <div className="relative group">
        <Link
          href="/app"
          className={cn(
            "relative flex h-11 w-11 items-center justify-center transition-all duration-500 md:h-14 md:w-14",
            pathname === "/app" ? "" : "hover:scale-110"
          )}
        >
          <div className={cn(
            "absolute inset-0 rounded-2xl border transition-all",
            pathname === "/app" ? "border-amber-300/70 bg-rose-500/15 shadow-[0_0_25px_rgba(251,113,133,0.28)]" : "border-slate-700/70 bg-slate-900/80 group-hover:border-amber-300/55"
          )} />
          <div className="relative flex h-8 w-8 items-center justify-center md:h-10 md:w-10">
            <img 
              src="/brand/nexusforge-logo.png" 
              alt="NexusForge" 
              width={40}
              height={40}
              className={cn(
                "h-auto w-8 object-contain transition-all md:w-10",
                pathname === "/app" ? "drop-shadow-sm" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
              )}
              draggable={false}
            />
          </div>
        </Link>
        {pathname === "/app" && (
           <div className="absolute -left-4 top-1/2 h-10 w-1.5 -translate-y-1/2 bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.45)]" />
        )}
      </div>

      <div className="h-px w-10 bg-slate-300/40 md:w-12" />

        {appServerLinks.filter(s => s.href !== "/app").map((server) => {
          const active = pathname.startsWith(server.href);
          return (
            <div key={server.href} className="relative group flex items-center justify-center">
              <Link
                href={server.href}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl border text-[9px] font-semibold uppercase tracking-tighter transition-all duration-300 md:h-12 md:w-12 nf-interact",
                  active 
                    ? "border-amber-300/70 bg-rose-500/15 text-amber-100 shadow-[0_0_18px_rgba(251,113,133,0.24)]" 
                    : "border-slate-700/70 bg-slate-900 text-slate-400 hover:border-slate-500/60 hover:text-slate-100",
                  !active && server.color
                )}
              >
                {server.label.substring(0, 2)}
              </Link>
              {active && (
                  <div className={cn(
                    "absolute -left-4 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full shadow-[0_0_10px]",
                    server.glow?.replace('shadow-', 'bg-') || "bg-amber-400",
                    server.glow || "shadow-amber-400"
                  )} />
              )}
            </div>
          );
        })}


      {/* Action System */}
      <div className="mt-auto space-y-3 md:space-y-4 pb-6 md:pb-12">
        <Link
          href="/app/rewards"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border bg-slate-900 transition-all md:h-12 md:w-12 nf-interact",
            pathname.startsWith("/app/rewards") 
                ? "border-amber-300/70 bg-amber-500/10 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.2)]" 
              : "border-slate-700/70 text-slate-400 hover:border-slate-500/60 hover:text-slate-100"
          )}
          aria-label="Economy Vault"
        >
          <Coins className="w-5 h-5" />
        </Link>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900 text-slate-400 transition-all hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-200 md:h-12 md:w-12 nf-interact"
          aria-label="Deploy New Node"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900 text-slate-400 transition-all hover:border-violet-400/60 hover:bg-violet-500/10 hover:text-violet-300 md:h-12 md:w-12 nf-interact"
          aria-label="Discover Protocols"
        >
          <Compass className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
