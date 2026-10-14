"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { siteNav } from "@/components/site/site-nav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

/** The public website's header: logo, main menu, sign in / join (or "Open app" when signed in). */
export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")) || (href === "/developer" && pathname.startsWith("/developer"));

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#040812]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Nexus Forge Gaming home">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-amber-400/30 bg-[#040812] shadow-[0_0_24px_rgba(46,164,255,0.3)]">
            <Image src="/brand/nexusforge-emblem-256.png" alt="" width={40} height={40} className="h-10 w-10 object-cover" />
          </span>
          <span className="hidden sm:block">
            <span className="nf-heading block text-sm font-semibold uppercase tracking-[0.3em] text-white">Nexus Forge</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-300">Gaming</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {siteNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                isActive(item.href) ? "bg-amber-500/10 text-amber-100 shadow-[inset_0_0_0_1px_rgba(46,164,255,0.3)]" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-[#0d1119] py-1 pl-1 pr-3 text-xs font-semibold text-slate-100 transition hover:border-amber-400/60">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-100">{(user.displayName || user.username).slice(0, 2).toUpperCase()}</span>
              )}
              Open app <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-amber-400/50 hover:text-white sm:inline-flex">
                Sign in
              </Link>
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-950 shadow-[0_10px_30px_rgba(46,164,255,0.35)] transition hover:-translate-y-px sm:px-5">
                Join free <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="site-mobile-nav" className="border-t border-white/5 px-4 py-2 md:hidden" aria-label="Main">
          {siteNav.map((item) => (
            <Link key={item.href} href={item.href} className={cn("block rounded-lg px-3 py-2.5 text-sm font-semibold", isActive(item.href) ? "bg-amber-500/10 text-amber-100" : "text-slate-200 hover:bg-white/5")}>
              {item.label}
            </Link>
          ))}
          {!user ? (
            <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">Sign in</Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
