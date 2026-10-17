"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { DEFAULT_LAYOUT_PREFS, LAYOUT_STORAGE_KEY, clampWidth, sanitizeLayoutPrefs, type LayoutPrefs } from "@/lib/layout/layout-prefs";

/**
 * Sidebar sizes and voice layout for this device (localStorage "nf-layout"). Window sizes differ per PC, so these are
 * not synced to the account. Reading or writing storage can throw when site data is blocked; the defaults apply then.
 */

function readPrefs(): LayoutPrefs {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_PREFS;
  try {
    return sanitizeLayoutPrefs(JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}"));
  } catch {
    return DEFAULT_LAYOUT_PREFS;
  }
}

function writePrefs(prefs: LayoutPrefs) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the layout still works for this visit.
  }
}

type LayoutStore = {
  prefs: LayoutPrefs;
  loaded: boolean;
  load: () => void;
  update: (patch: Partial<LayoutPrefs>) => void;
  setWidth: (side: "left" | "right", width: number) => void;
  toggle: (side: "left" | "right") => void;
  reset: () => void;
};

export const useLayoutStore = create<LayoutStore>()((set, get) => ({
  prefs: DEFAULT_LAYOUT_PREFS,
  loaded: false,
  load: () => {
    if (get().loaded) return;
    set({ prefs: readPrefs(), loaded: true });
  },
  update: (patch) => {
    const prefs = sanitizeLayoutPrefs({ ...get().prefs, ...patch });
    writePrefs(prefs);
    set({ prefs });
  },
  setWidth: (side, width) => get().update(side === "left" ? { leftWidth: clampWidth("left", width) } : { rightWidth: clampWidth("right", width) }),
  toggle: (side) => {
    const { prefs } = get();
    get().update(side === "left" ? { leftCollapsed: !prefs.leftCollapsed } : { rightCollapsed: !prefs.rightCollapsed });
  },
  reset: () => {
    writePrefs(DEFAULT_LAYOUT_PREFS);
    set({ prefs: DEFAULT_LAYOUT_PREFS });
  },
}));

/** Loads the saved layout once on the client. Changes in another window of the app (a popout) are picked up too. */
export function useLayoutPrefs(): LayoutPrefs {
  const prefs = useLayoutStore((state) => state.prefs);
  const load = useLayoutStore((state) => state.load);
  useEffect(() => {
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === LAYOUT_STORAGE_KEY) useLayoutStore.setState({ prefs: readPrefs() });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);
  return prefs;
}

/** The window's width in CSS pixels, updated on resize (0 during server rendering). */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
