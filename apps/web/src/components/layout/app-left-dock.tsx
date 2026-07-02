"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appServerLinks } from "@/lib/app-servers";
import { cn } from "@/lib/utils";
import { Plus, Compass, Terminal, Coins } from "lucide-react";

export function AppLeftDock({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/app";

  return (
    <nav className={cn("flex flex-col items-center py-6 gap-6 bg-black border-r border-white/5 h-screen w-[80px] z-50", className)} aria-label="Nexus Control Dock">
      {/* Nexus Core Link */}
      <div className="relative group">
        <Link
          href="/app"
          className={cn(
            "relative w-14 h-14 flex items-center justify-center transition-all duration-500",
            pathname === "/app" ? "" : "hover:scale-110"
          )}
        >
          <div className={cn(
            "absolute inset-0 border transition-all nexus-corner-tick",
            pathname === "/app" ? "border-nexus-cyan bg-nexus-cyan/10 shadow-[0_0_30px_rgba(0,242,255,0.5)]" : "border-white/10 bg-white/2 group-hover:border-nexus-cyan/50"
          )} />
          <div className="relative w-10 h-10 flex items-center justify-center">
            <Image 
              src="/brand/nexusforge-logo.png" 
              alt="NexusForge" 
              width={40} 
              height={40} 
              className={cn(
                "object-contain filter transition-all",
                pathname === "/app" ? "brightness-125 saturate-150 drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]" : "brightness-50 grayscale group-hover:grayscale-0 group-hover:brightness-110"
              )}
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        </Link>
        {pathname === "/app" && (
           <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-nexus-cyan shadow-[0_0_15px_rgba(0,242,255,0.6)]" />
        )}
      </div>

      <div className="w-12 h-px bg-white/10" />

        {appServerLinks.filter(s => s.href !== "/app").map((server) => {
          const active = pathname.startsWith(server.href);
          return (
            <div key={server.href} className="relative group flex items-center justify-center">
              <Link
                href={server.href}
                className={cn(
                  "w-12 h-12 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter border transition-all duration-300 nexus-corner-tick",
                  active 
                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                    : "bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/30 hover:text-white",
                  !active && server.color
                )}
              >
                {server.label.substring(0, 2)}
              </Link>
              {active && (
                 <div className={cn(
                    "absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-8 shadow-[0_0_10px]",
                    server.glow?.replace('shadow-', 'bg-') || "bg-nexus-gold",
                    server.glow || "shadow-nexus-gold"
                 )} />
              )}
            </div>
          );
        })}


      {/* Action System */}
      <div className="mt-auto space-y-4 pb-12">
        <Link
          href="/app/rewards"
          className={cn(
            "w-12 h-12 flex items-center justify-center bg-transparent border transition-all",
            pathname.startsWith("/app/rewards") 
              ? "border-nexus-gold text-nexus-gold bg-nexus-gold/5 shadow-[0_0_15px_rgba(251,191,36,0.2)]" 
              : "border-white/10 text-slate-600 hover:border-nexus-gold/50 hover:text-nexus-gold"
          )}
          aria-label="Economy Vault"
        >
          <Coins className="w-5 h-5" />
        </Link>
        <button
          className="w-12 h-12 flex items-center justify-center bg-transparent border border-white/10 text-slate-600 hover:border-nexus-cyan/50 hover:text-nexus-cyan transition-all"
          aria-label="Deploy New Node"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          className="w-12 h-12 flex items-center justify-center bg-transparent border border-white/10 text-slate-600 hover:border-nexus-purple/50 hover:text-nexus-purple transition-all"
          aria-label="Discover Protocols"
        >
          <Compass className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
