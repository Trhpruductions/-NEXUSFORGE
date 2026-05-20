"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appServerLinks } from "@/lib/app-servers";

export function AppLeftDock({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/app";

  return (
    <nav className={className} aria-label="Application quick navigation">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 shadow-[0_0_28px_rgba(251,211,36,0.3)]">
        <Image
          src="/brand/nexusforge-logo.png"
          alt="NexusForge"
          width={24}
          height={24}
          className="object-contain"
        />
      </div>
      {appServerLinks.map((server) => (
        <Link
          key={server.href}
          href={server.href}
          title={server.title}
          className={`flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-700/70 bg-slate-950/85 text-sm font-semibold text-slate-200 transition hover:border-amber-400/70 hover:bg-slate-900/95 ${
            pathname === server.href || (server.href !== "/app" && pathname.startsWith(server.href))
              ? "border-amber-400/60 bg-amber-500/10 text-amber-100 shadow-[0_12px_30px_rgba(251,191,36,0.16)]"
              : ""
          }`}
        >
          {server.label}
        </Link>
      ))}
      <button
        type="button"
        disabled
        aria-label="Create new item (coming soon)"
        className="mt-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-700/70 bg-slate-950/85 text-xl font-bold text-amber-300 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>
    </nav>
  );
}
