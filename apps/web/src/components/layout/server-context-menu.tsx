"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { ServerMenuItem } from "@/components/layout/server-menu-model";

const MENU_WIDTH = 224;
const ITEM_HEIGHT = 36;

/**
 * The right-click menu on a server in the rail. Keyboard: arrow keys move between items, Escape closes, and the
 * menu closes on any click outside it, on resize and on scroll. Items are plain buttons, so Enter and Space work.
 */
export function ServerContextMenu({
  serverName,
  x,
  y,
  items,
  loading,
  onSelect,
  onClose,
}: {
  serverName: string;
  x: number;
  y: number;
  items: ServerMenuItem[];
  loading: boolean;
  onSelect: (item: ServerMenuItem) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The parent passes a new close function on every render. The ref keeps the latest one, so the listeners
  // below are attached once per open, and the first item keeps focus.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const close = () => closeRef.current();
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (buttons.length === 0) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    buttons[(current + step + buttons.length) % buttons.length].focus();
  };

  // Keep the menu on screen: move it left or up when it would run off the edge.
  const estimatedHeight = Math.min(items.length * ITEM_HEIGHT + 56, window.innerHeight * 0.8);
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8));

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${serverName} server menu`}
      onKeyDown={onKeyDown}
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[90] max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0d1119] p-1.5 shadow-2xl"
    >
      <p className="truncate px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{serverName}</p>
      {loading ? <p className="px-2.5 py-2 text-[11px] text-slate-500">Loading server options…</p> : null}
      {items.map((item) => (
        <div key={item.id}>
          {item.dividerBefore ? <div role="separator" className="my-1 h-px bg-white/10" /> : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => onSelect(item)}
            className={`block w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition focus:bg-white/[0.08] focus:outline-none ${
              item.danger ? "text-rose-300 hover:bg-rose-500/10" : "text-slate-200 hover:bg-white/[0.06]"
            }`}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
