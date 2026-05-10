"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPortalSession, getBillingEntitlements, savePushSubscription, updateMe } from "@/lib/api";
import Link from "next/link";

const WEB_PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";

type PresenceStatus = "ONLINE" | "IDLE" | "DND" | "OFFLINE";

type ProfileFormState = {
  username: string;
  avatar: string;
  banner: string;
  bio: string;
  clanTag: string;
  status: PresenceStatus;
  currentActivity: string;
  activityDetails: string;
};

export function ProfileSettingsForm() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [form, setForm] = useState<ProfileFormState>({
    username: "",
    avatar: "",
    banner: "",
    bio: "",
    clanTag: "",
    status: "OFFLINE",
    currentActivity: "",
    activityDetails: "",
  });
  const [pushState, setPushState] = useState("idle");
  const [savingPush, setSavingPush] = useState(false);

  const billingQuery = useQuery({
    queryKey: ["billing-entitlements", accessToken],
    queryFn: () => getBillingEntitlements(accessToken!),
    enabled: Boolean(accessToken),
  });

  const hasBrandingKit = billingQuery.data?.entitlements.some((item) => item.featureCode === "TEAM_BRANDING_KIT" && item.quantity > 0) ?? false;
  const cosmeticFieldsFilled = Boolean(form.avatar.trim() || form.banner.trim());
  const cosmeticUpsellVisible = cosmeticFieldsFilled && !hasBrandingKit;

  useEffect(() => {
    if (!user) return;
    setForm({
      username: user.username ?? "",
      avatar: user.avatar ?? "",
      banner: user.banner ?? "",
      bio: user.bio ?? "",
      clanTag: user.clanTag ?? "",
      status: user.status,
      currentActivity: user.currentActivity ?? "",
      activityDetails: user.activityDetails ?? "",
    });
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMe(accessToken!, csrfToken!, {
        username: form.username || undefined,
        avatar: form.avatar || null,
        banner: form.banner || null,
        bio: form.bio || null,
        clanTag: form.clanTag || null,
        status: form.status,
        currentActivity: form.currentActivity || null,
        activityDetails: form.activityDetails || null,
      }),
    onSuccess: async (result) => {
      useAuthStore.setState((state) => ({ ...state, user: result.user }));
      await queryClient.invalidateQueries({ queryKey: ["notifications", accessToken] });
    },
  });

  const saveErrorMessage = axios.isAxiosError(saveMutation.error)
    ? ((saveMutation.error.response?.data as { message?: string; error?: string } | undefined)?.message ?? saveMutation.error.response?.data?.error ?? saveMutation.error.message)
    : saveMutation.error instanceof Error
      ? saveMutation.error.message
      : null;

  const billingPortalMutation = useMutation({
    mutationFn: () => createPortalSession(accessToken!, csrfToken!),
    onSuccess: (result) => {
      if (result.url) {
        window.location.assign(result.url);
      }
    },
  });

  const enablePush = async () => {
    if (!accessToken || !csrfToken) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("Push not supported in this browser.");
      return;
    }

    setSavingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("Push permission denied.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!WEB_PUSH_PUBLIC_KEY) {
        localStorage.setItem("nexusforge_push_opt_in", "true");
        setPushState("Push groundwork enabled. Add NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY to complete browser subscription.");
        return;
      }

      const urlBase64ToUint8Array = (value: string): Uint8Array => {
        const padding = "=".repeat((4 - (value.length % 4)) % 4);
        const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
      };

      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY) as unknown as BufferSource,
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription payload");
      }

      await savePushSubscription(accessToken, csrfToken, {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        deviceName: navigator.userAgent,
        platform: navigator.platform,
      });
      setPushState("Push subscription saved.");
    } catch (error) {
      setPushState(error instanceof Error ? error.message : "Push setup failed.");
    } finally {
      setSavingPush(false);
    }
  };

  if (!accessToken || !csrfToken || !user) {
    return <p className="text-sm text-slate-400">Sign in to edit your profile.</p>;
  }

  return (
    <div className="nexus-panel grid gap-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/15 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.18em] text-amber-200">Core+ Status</span>
        <span className="rounded-full border border-amber-500/45 bg-amber-950/35 px-2 py-0.5 text-amber-100">
          {user.premium ? user.premiumTier ?? "CORE" : "NONE"}
        </span>
        <span className="rounded-full border border-cyan-500/35 bg-cyan-950/25 px-2 py-0.5 text-cyan-100">
          Boost {user.corePlusBoostLevel ?? 0}
        </span>
        <span className="rounded-full border border-emerald-500/35 bg-emerald-950/25 px-2 py-0.5 text-emerald-100">
          Streak {user.corePlusStreakDays ?? 0}d
        </span>
      </div>

      <div className="grid gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 md:grid-cols-[1.2fr_auto] md:items-center">
        <div className="space-y-1 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Billing Control</p>
          <p>
            Subscription: {billingQuery.data?.premium.subscription?.status ?? "NONE"}
            {billingQuery.data?.premium.subscription?.interval ? ` · ${billingQuery.data.premium.subscription.interval}` : ""}
          </p>
          <p className="text-xs text-slate-400">
            {billingQuery.data?.premium.subscription?.currentPeriodEnd
              ? `Renews ${new Date(billingQuery.data.premium.subscription.currentPeriodEnd).toLocaleDateString()}`
              : "No active managed subscription yet."}
          </p>
          <p className="text-xs text-slate-400">
            Add-ons active: {billingQuery.data?.entitlements.length ?? 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => billingPortalMutation.mutate()} disabled={billingPortalMutation.isPending || !billingQuery.data?.premium.subscription}>
            {billingPortalMutation.isPending ? "Opening Portal..." : "Manage Billing"}
          </Button>
          <Link href="/pricing" className="inline-flex h-11 items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300">
            Open Pricing
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Clan Tag" value={form.clanTag} onChange={(e) => setForm({ ...form, clanTag: e.target.value })} />
        <Input label="Avatar URL" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
        <Input label="Banner URL" value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} />
        <Input label="Current Activity" value={form.currentActivity} onChange={(e) => setForm({ ...form, currentActivity: e.target.value })} />
        <Input label="Activity Details" value={form.activityDetails} onChange={(e) => setForm({ ...form, activityDetails: e.target.value })} />
        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          <span className="font-medium tracking-wide text-slate-200">Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="min-h-28 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            placeholder="Tell the community about you"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          <span className="font-medium tracking-wide text-slate-200">Presence</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as PresenceStatus })}
            aria-label="Select presence status"
            title="Select presence status"
            className="h-11 rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-slate-100 outline-none focus:border-cyan-400"
          >
            <option value="ONLINE">Online</option>
            <option value="IDLE">Idle</option>
            <option value="DND">Do Not Disturb</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>
      </div>

      {cosmeticUpsellVisible ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-sm text-amber-100">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Premium cosmetics</p>
          <p className="mt-2">Custom avatar and banner identity require the Team Branding Kit entitlement.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/pricing" className="inline-flex h-10 items-center rounded-xl border border-amber-400/45 bg-amber-400 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-300">
              Unlock Team Branding Kit
            </Link>
            <Link href="/core-plus" className="inline-flex h-10 items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300">
              Review Billing
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
        <Button variant="ghost" onClick={() => void enablePush()} disabled={savingPush}>
          {savingPush ? "Preparing..." : "Enable Push"}
        </Button>
      </div>

      {pushState ? <p className="text-xs text-cyan-300">{pushState}</p> : null}
      {saveErrorMessage ? <p className="text-xs text-amber-300">{saveErrorMessage}</p> : null}
      {billingPortalMutation.error ? <p className="text-xs text-amber-300">Billing portal is unavailable until an active Stripe customer record exists.</p> : null}
    </div>
  );
}
