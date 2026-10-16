"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Guards unsaved edits in two ways:
 *  - the browser's own prompt when the tab is closed or reloaded (beforeunload);
 *  - an in-app check for same-site link clicks, which asks first and then navigates.
 * Browser Back inside the app is not intercepted: Next.js handles it before any page code runs.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null | undefined;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /** Leave now if nothing is unsaved; otherwise ask first. */
  const requestLeave = useCallback(
    (href: string) => {
      if (!dirtyRef.current) {
        allowLeaveRef.current = true;
        router.push(href);
        return;
      }
      setPendingHref(href);
    },
    [router],
  );

  /** The user chose to discard their edits and leave. */
  const confirmLeave = useCallback(() => {
    if (!pendingHref) return;
    allowLeaveRef.current = true;
    router.push(pendingHref);
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => setPendingHref(null), []);

  return { pendingHref, requestLeave, confirmLeave, cancelLeave };
}
