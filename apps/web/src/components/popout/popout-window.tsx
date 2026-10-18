"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shows its children in a separate window. The window is a blank page of this app; React draws into it from here
 * (a portal), so the children keep using this page's state, voice call and media streams. Styles and the theme are
 * copied over and kept in sync. Closing the window calls onClosed; unmounting this closes the window.
 */

type OpenWindow = { win: Window; closeTimer: number | null };
const openWindows = new Map<string, OpenWindow>();
let unloadHooked = false;

/** Closing or reloading the main page closes every popout, so none is left behind without its call. */
function hookUnload() {
  if (unloadHooked || typeof window === "undefined") return;
  unloadHooked = true;
  window.addEventListener("pagehide", () => {
    for (const entry of openWindows.values()) {
      try {
        entry.win.close();
      } catch {
        // already gone
      }
    }
    openWindows.clear();
  });
}

export function focusPopout(name: string) {
  const entry = openWindows.get(name);
  if (entry && !entry.win.closed) entry.win.focus();
}

/**
 * The popout windows open right now. Page-wide keyboard handling (push-to-talk) listens in these too: keys pressed
 * while a popout has focus never reach the main window.
 */
const windowWatchers = new Set<() => void>();
export function openPopoutWindows(): Window[] {
  return [...openWindows.values()].map((entry) => entry.win).filter((win) => !win.closed);
}
export function watchPopoutWindows(onChange: () => void): () => void {
  windowWatchers.add(onChange);
  return () => {
    windowWatchers.delete(onChange);
  };
}
function popoutWindowsChanged() {
  for (const watcher of windowWatchers) watcher();
}

function copyNode(node: Node, target: Document): Node | null {
  if (node instanceof HTMLLinkElement && node.rel === "stylesheet") {
    const link = target.createElement("link");
    link.rel = "stylesheet";
    link.href = node.href; // absolute, so it resolves the same in the blank window
    return link;
  }
  if (node instanceof HTMLStyleElement) {
    const style = target.createElement("style");
    style.textContent = node.textContent;
    return style;
  }
  return null;
}

/** html and body attributes carry the theme, accent, effects and fonts. */
function mirrorAttributes(from: HTMLElement, to: HTMLElement) {
  for (const attribute of Array.from(to.attributes)) if (!from.hasAttribute(attribute.name)) to.removeAttribute(attribute.name);
  for (const attribute of Array.from(from.attributes)) to.setAttribute(attribute.name, attribute.value);
}

export function PopoutWindow({
  name,
  title,
  width,
  height,
  onClosed,
  focusSignal,
  children,
}: {
  /** Window name; the desktop app only allows names from popoutWindowName(). */
  name: string;
  title: string;
  width: number;
  height: number;
  /** blocked: the browser or app refused to open the window. closed: the user closed it. */
  onClosed: (reason: "blocked" | "closed") => void;
  /** Changing this brings the window to the front. */
  focusSignal?: number;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);
  const winRef = useRef<Window | null>(null);

  useEffect(() => {
    hookUnload();
    let entry = openWindows.get(name);
    // React may mount, unmount and mount again quickly (development): keep the window that is still closing.
    if (entry && !entry.win.closed && entry.closeTimer !== null) {
      window.clearTimeout(entry.closeTimer);
      entry.closeTimer = null;
    } else {
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const win = window.open("", name, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
      if (!win) {
        onClosedRef.current("blocked");
        return;
      }
      entry = { win, closeTimer: null };
      openWindows.set(name, entry);
    }
    const { win } = entry;
    winRef.current = win;
    const doc = win.document;

    // Styles: what the page has now, plus anything added later (lazy chunks, theme sheets).
    doc.head.querySelectorAll("[data-nf-popout-style]").forEach((node) => node.remove());
    const copied = new Map<Node, Node>();
    const addCopy = (node: Node) => {
      const copy = copyNode(node, doc);
      if (!copy) return;
      (copy as HTMLElement).setAttribute("data-nf-popout-style", "");
      doc.head.appendChild(copy);
      copied.set(node, copy);
    };
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(addCopy);
    const headObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(addCopy);
        record.removedNodes.forEach((node) => {
          copied.get(node)?.parentNode?.removeChild(copied.get(node)!);
          copied.delete(node);
        });
      }
    });
    headObserver.observe(document.head, { childList: true });

    mirrorAttributes(document.documentElement, doc.documentElement);
    mirrorAttributes(document.body, doc.body);
    const themeObserver = new MutationObserver(() => {
      mirrorAttributes(document.documentElement, doc.documentElement);
      mirrorAttributes(document.body, doc.body);
    });
    themeObserver.observe(document.documentElement, { attributes: true });
    themeObserver.observe(document.body, { attributes: true });

    if (!doc.querySelector('meta[name="viewport"]')) {
      const meta = doc.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1";
      doc.head.appendChild(meta);
    }
    doc.body.style.margin = "0";
    let root = doc.getElementById("nf-popout-root");
    if (!root) {
      root = doc.createElement("div");
      root.id = "nf-popout-root";
      root.style.height = "100vh";
      doc.body.replaceChildren(root);
    }
    setContainer(root);
    popoutWindowsChanged();

    // The user closed the window (or it navigated away): tell the owner so the panel comes back.
    let reported = false;
    const report = () => {
      if (reported) return;
      reported = true;
      openWindows.delete(name);
      popoutWindowsChanged();
      onClosedRef.current("closed");
    };
    win.addEventListener("pagehide", report);
    // pagehide doesn't always fire for a blank window that is closed from outside; check as well.
    const poll = window.setInterval(() => {
      if (win.closed) report();
    }, 800);

    return () => {
      headObserver.disconnect();
      themeObserver.disconnect();
      window.clearInterval(poll);
      win.removeEventListener("pagehide", report);
      setContainer(null);
      const current = openWindows.get(name);
      if (!current || reported) return;
      // Close a moment later, so an immediate re-mount can keep the same window.
      current.closeTimer = window.setTimeout(() => {
        openWindows.delete(name);
        try {
          current.win.close();
        } catch {
          // already gone
        }
        popoutWindowsChanged();
      }, 50);
    };
    // Opening is keyed on the name; size changes don't reopen the window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    const win = winRef.current;
    if (container && win && !win.closed) win.document.title = title;
  }, [container, title]);

  useEffect(() => {
    if (focusSignal && winRef.current && !winRef.current.closed) winRef.current.focus();
  }, [focusSignal]);

  return container ? createPortal(children, container) : null;
}
