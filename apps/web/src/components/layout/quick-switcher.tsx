"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AtSign, Compass, Hash, LayoutGrid, Megaphone, Radio, Search, Volume2 } from "lucide-react";
import { listDmThreads, type Channel, type Forge } from "@/lib/api";
import { alpha, hues, hueFor } from "@/lib/colors";
import { useAuthStore } from "@/store/auth-store";

type Item = {
  id: string;
  kind: "forge" | "channel" | "dm" | "page";
  label: string;
  hint: string;
  href: string;
  icon: typeof Hash;
  color: string;
  forgeId?: string;
};

const pages: Array<{ label: string; href: string; hue: keyof typeof hues }> = [
  { label: "Home", href: "/app", hue: "amber" },
  { label: "Feed", href: "/app/feed", hue: "sky" },
  { label: "Friends", href: "/app/friends", hue: "emerald" },
  { label: "Events", href: "/app/events", hue: "emerald" },
  { label: "Store", href: "/app/store", hue: "orange" },
  { label: "Avatar Studio", href: "/app/avatar", hue: "fuchsia" },
  { label: "Discover", href: "/app/discover", hue: "indigo" },
  { label: "Rewards & Coins", href: "/app/rewards", hue: "amber" },
  { label: "Notifications", href: "/app/notifications", hue: "rose" },
  { label: "Settings", href: "/app/settings", hue: "cyan" },
  { label: "Support", href: "/app/support", hue: "teal" },
  { label: "Legal Center", href: "/legal", hue: "violet" },
];

/** Higher is better; 0 means no match. Prefix > word start > anywhere > in-order letters. */
function score(text: string, query: string) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 100 - t.length / 100;
  if (t.split(/[\s\-_#@]+/).some((word) => word.startsWith(q))) return 80;
  if (t.includes(q)) return 60;
  let i = 0;
  for (const char of t) if (char === q[i]) i += 1;
  return i === q.length ? 30 : 0;
}

/** Ctrl/Cmd+K: jump to any server, channel, conversation or page by typing. */
export function QuickSwitcher({
  forges,
  forge,
  onSelectForge,
}: {
  forges: Forge[];
  forge: { id: string; name: string; channels: Channel[] } | null | undefined;
  onSelectForge: (forgeId: string) => void;
}) {
  const router = useRouter();
  const { accessToken, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("vexora:quick-switcher", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("vexora:quick-switcher", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const dmQuery = useQuery({ queryKey: ["dm-threads", accessToken], queryFn: () => listDmThreads(accessToken!), enabled: Boolean(open && accessToken) });

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const channel of forge?.channels ?? []) {
      if (channel.type === "CATEGORY") continue;
      const voice = channel.type === "VOICE" || channel.type === "STAGE";
      list.push({
        id: `c-${channel.id}`,
        kind: "channel",
        label: channel.name,
        hint: forge!.name,
        href: `/app/chat?forge=${forge!.id}&${voice ? "voice" : "channel"}=${channel.id}`,
        icon: channel.type === "VOICE" ? Volume2 : channel.type === "STAGE" ? Radio : channel.type === "ANNOUNCEMENT" ? Megaphone : Hash,
        color: channel.type === "VOICE" ? hues.emerald.base : channel.type === "STAGE" ? hues.pink.base : channel.type === "ANNOUNCEMENT" ? hues.orange.base : hues.sky.base,
        forgeId: forge!.id,
      });
    }
    for (const thread of dmQuery.data?.threads ?? []) {
      const others = thread.participants.filter((entry) => entry.user.id !== user?.id).map((entry) => entry.user.username);
      list.push({
        id: `d-${thread.id}`,
        kind: "dm",
        label: thread.isGroup ? thread.name || others.join(", ") : others[0] ?? "Direct message",
        hint: thread.isGroup ? "Group message" : "Direct message",
        href: `/app/chat?dm=${thread.id}`,
        icon: AtSign,
        color: hues.pink.base,
      });
    }
    for (const entry of forges) {
      list.push({ id: `f-${entry.id}`, kind: "forge", label: entry.name, hint: "Server", href: `/app/chat?forge=${entry.id}`, icon: LayoutGrid, color: hueFor(entry.id).base, forgeId: entry.id });
    }
    for (const page of pages) {
      list.push({ id: `p-${page.href}`, kind: "page", label: page.label, hint: "Go to", href: page.href, icon: Compass, color: hues[page.hue].base });
    }
    return list;
  }, [forge, forges, dmQuery.data, user?.id]);

  const results = useMemo(() => {
    const q = query.trim().replace(/^[#@]/, "");
    const typeFilter = query.trim().startsWith("#") ? "channel" : query.trim().startsWith("@") ? "dm" : null;
    return items
      .filter((item) => !typeFilter || item.kind === typeFilter)
      .map((item) => ({ item, s: Math.max(score(item.label, q), score(item.hint, q) * 0.5) }))
      .filter((entry) => entry.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((entry) => entry.item);
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    if (item.forgeId) onSelectForge(item.forgeId);
    router.push(item.href);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1150] flex items-start justify-center px-3 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Quick switcher" className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/70 via-amber-400/80 to-cyan-400/70" />
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4">
          <Search className="h-4 w-4 shrink-0 text-violet-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(results.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(results[active]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Where would you like to go?"
            aria-label="Search servers, channels, messages and pages"
            aria-activedescendant={results[active] ? `qs-${results[active].id}` : undefined}
            aria-controls="quick-switcher-list"
            role="combobox"
            aria-expanded="true"
            className="h-14 w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="hidden rounded border border-white/10 px-1.5 text-[10px] text-slate-500 sm:block">Esc</kbd>
        </div>
        <ul id="quick-switcher-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.map((item, index) => (
            <li key={item.id} id={`qs-${item.id}`} role="option" aria-selected={index === active} data-index={index}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${index === active ? "bg-white/[0.07] text-white" : "text-slate-300"}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: alpha(item.color, 0.18), color: item.color }}>
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{item.hint}</span>
              </button>
            </li>
          ))}
          {!results.length ? <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing matches “{query}”.</li> : null}
        </ul>
        <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-slate-500">
          Tip: start with <span className="text-sky-300">#</span> for channels or <span className="text-pink-300">@</span> for conversations. ↑↓ to move, Enter to open.
        </p>
      </div>
    </div>,
    document.body,
  );
}
