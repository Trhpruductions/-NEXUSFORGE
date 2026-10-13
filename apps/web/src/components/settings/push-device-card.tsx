"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { api, authHeaders, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(padded), (char) => char.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Push for THIS browser/device: asks the browser for permission, subscribes it and tells
 * the server. (The "Push notifications" switch above decides whether anything is sent.)
 */
export function PushDeviceCard() {
  const { accessToken, csrfToken } = useAuthStore();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !PUBLIC_KEY) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      setState((await registration.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    if (!accessToken || !csrfToken) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) as unknown as BufferSource }));
      const json = subscription.toJSON();
      await api.post(
        "/api/auth/push-subscriptions",
        { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, deviceName: deviceName(), platform: "web" },
        { headers: authHeaders(accessToken, csrfToken) },
      );
      setState("on");
      setMessage("Push is on for this device.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!accessToken || !csrfToken) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete("/api/auth/push-subscriptions", { headers: authHeaders(accessToken, csrfToken), data: { endpoint: subscription.endpoint } }).catch(() => undefined);
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Push is off for this device.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!accessToken || !csrfToken) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/api/auth/push-subscriptions/test", {}, { headers: authHeaders(accessToken, csrfToken) });
      setMessage("Test sent. It should appear in a few seconds.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.05] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">This device</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
        {state === "checking" ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</span> : null}
        {state === "unsupported" ? <span>This browser can&apos;t receive push notifications.</span> : null}
        {state === "blocked" ? <span>Notifications are blocked for Vexora in this browser. Allow them in the browser&apos;s site settings, then come back.</span> : null}
        {state === "off" ? (
          <>
            <span>Get notified even when Vexora is closed.</span>
            <button type="button" onClick={() => void turnOn()} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} Turn on push
            </button>
          </>
        ) : null}
        {state === "on" ? (
          <>
            <span className="flex items-center gap-1.5"><BellRing className="h-4 w-4 text-emerald-300" /> Push is on for this device.</span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => void test()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-200 hover:border-sky-400/50"><Send className="h-3.5 w-3.5" /> Send a test</button>
              <button type="button" onClick={() => void turnOff()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-200"><BellOff className="h-3.5 w-3.5" /> Turn off</button>
            </div>
          </>
        ) : null}
      </div>
      {message ? <p className="mt-2 text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
