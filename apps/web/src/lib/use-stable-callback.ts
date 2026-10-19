"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * A function that never changes identity but always runs the latest `fn`. For event handlers handed to memoised
 * children (message rows): an inline arrow is a new function on every render, which makes React.memo re-render the
 * child anyway. Only call the result from event handlers or effects, not while rendering.
 */
export function useStableCallback<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(fn);
  // Insertion effects run before layout effects and before any event can fire, so handlers never see a stale fn.
  useInsertionEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
