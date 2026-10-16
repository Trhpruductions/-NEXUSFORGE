"use client";

import { useAuthStore } from "@/store/auth-store";

/** What the server says about a suspended account. `until` null = until staff lift it. */
export type SuspensionInfo = { reason: string; until: string | null; since: string; kind?: "STAFF" | "VAC"; category?: string | null; appealed?: boolean };

const STORAGE_KEY = "vx-suspension";

export function isSuspensionInfo(value: unknown): value is SuspensionInfo {
  return Boolean(value && typeof value === "object" && typeof (value as SuspensionInfo).reason === "string");
}

export function readSuspension(): SuspensionInfo | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSuspensionInfo(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remembers in this browser that an appeal was sent, so a reload shows the sent state instead of the form again. */
export function markSuspensionAppealed(): SuspensionInfo | null {
  const info = readSuspension();
  if (!info) return null;
  const next = { ...info, appealed: true };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the sent state lasts until the page is left */
  }
  return next;
}

let handled = false;

/**
 * The account was suspended (on sign-in, on any request, or live while using the app):
 * forget the session in this browser and show the suspension page.
 */
export function handleSuspended(info: SuspensionInfo | null) {
  try {
    if (info) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    /* storage blocked: the page still explains the basics */
  }
  if (handled) return;
  handled = true;
  useAuthStore.getState().clearSession();
  void useAuthStore.persist.clearStorage();
  if (window.location.pathname !== "/suspended") window.location.assign("/suspended");
}
