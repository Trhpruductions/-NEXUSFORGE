"use client";

import Link from "next/link";
import { Calendar, Home, Layers, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Chat", href: "/app/chat", icon: MessageSquare },
  { label: "Friends", href: "/app/friends", icon: Users },
  { label: "Events", href: "/app/events", icon: Calendar },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom navigation for phones: the four places people open most, plus More, which opens the full menu.
 * The shell hides it on full-height pages (chat), where the message box needs the bottom of the screen.
 */
export function MobileTabBar({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0e17]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition",
                  active ? "text-amber-200" : "text-slate-400 hover:text-white",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition", active && "bg-amber-400/15 ring-1 ring-amber-400/40")}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-400 transition hover:text-white"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
