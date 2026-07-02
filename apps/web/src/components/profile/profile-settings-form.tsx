"use client";

import axios from "axios";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPortalSession, getBillingEntitlements, getPublicProfile, savePushSubscription, updateMe } from "@/lib/api";
import { ProfileMetadata } from "@/components/profile/profile-metadata";
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

type ProfileUserSnapshot = {
  username?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bio?: string | null;
  clanTag?: string | null;
  status?: PresenceStatus;
  currentActivity?: string | null;
  activityDetails?: string | null;
};

function buildProfileFormState(user?: ProfileUserSnapshot | null): ProfileFormState {
  return {
    username: user?.username ?? "",
    avatar: user?.avatar ?? "",
    banner: user?.banner ?? "",
    bio: user?.bio ?? "",
    clanTag: user?.clanTag ?? "",
    status: user?.status ?? "OFFLINE",
    currentActivity: user?.currentActivity ?? "",
    activityDetails: user?.activityDetails ?? "",
  };
}

export function ProfileSettingsForm() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [draft, setDraft] = useState<Partial<ProfileFormState>>({});
  const [pushState, setPushState] = useState("idle");
  const [savingPush, setSavingPush] = useState(false);

  const form = {
    ...buildProfileFormState(user),
    ...draft,
  } satisfies ProfileFormState;
  const intent = searchParams?.get("intent") ?? undefined;

  const updateDraft = <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const billingQuery = useQuery({
    queryKey: ["billing-entitlements", accessToken],
    queryFn: () => getBillingEntitlements(accessToken!),
    enabled: Boolean(accessToken),
  });

  const rankQuery = useQuery({
    queryKey: ["profile-ranks", accessToken, user?.id],
    queryFn: () => getPublicProfile(accessToken!, user!.id),
    enabled: Boolean(accessToken && user?.id),
    staleTime: 30000,
  });

  const hasBrandingKit = billingQuery.data?.entitlements.some((item) => item.featureCode === "TEAM_BRANDING_KIT" && item.quantity > 0) ?? false;
  const betaCosmeticsBypassUsers = new Set(["jacksongaming69"]);
  const isBetaCosmeticsBypass = betaCosmeticsBypassUsers.has((user?.username ?? "").toLowerCase());
  const cosmeticFieldsFilled = Boolean(form.avatar.trim() || form.banner.trim());
  const cosmeticUpsellVisible = cosmeticFieldsFilled && !hasBrandingKit && !isBetaCosmeticsBypass;

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
      setDraft({});
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
    <>
      <ProfileMetadata
        user={{
          ...user,
          appRank: rankQuery.data?.appRank,
          boostRank: rankQuery.data?.boostRank,
        }}
      />
      {intent === "create-forge" ? (
        <div className="mb-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700">Quick start</p>
          <p className="mt-2">Create Forge was selected from the home panel. Continue to the forge tools to launch your new community workspace.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/app" className="inline-flex h-10 items-center rounded-full border border-amber-200 bg-white px-4 text-xs font-semibold text-amber-800 hover:bg-amber-100">
              Open workspace
            </Link>
            <Link href="/search?q=community" className="inline-flex h-10 items-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Explore communities
            </Link>
          </div>
        </div>
      ) : null}
      <div className="nexus-display-panel relative grid gap-4 rounded-[24px] p-5 sm:p-6">
        <div className="nexus-ambient" aria-hidden="true">
          <div className="nexus-ambient-orb nexus-ambient-orb-a" />
          <div className="nexus-ambient-orb nexus-ambient-orb-b" />
        </div>

        <div className="relative flex flex-wrap items-center gap-2 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <span className="font-semibold uppercase tracking-[0.18em] text-amber-700">Core+ Status</span>
          <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700">
            {user.premium ? user.premiumTier ?? "CORE" : "NONE"}
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700">
            Boost {user.corePlusBoostLevel ?? 0}
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700">
            Streak {user.corePlusStreakDays ?? 0}d
          </span>
        </div>

        <div className="relative grid gap-3 rounded-[18px] border border-amber-200 bg-amber-50/70 p-4 md:grid-cols-[1.2fr_auto] md:items-center">
          <div className="space-y-1 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Billing Control</p>
            <p>
              Subscription: {billingQuery.data?.premium.subscription?.status ?? "NONE"}
              {billingQuery.data?.premium.subscription?.interval ? ` · ${billingQuery.data.premium.subscription.interval}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {billingQuery.data?.premium.subscription?.currentPeriodEnd
                ? `Renews ${new Date(billingQuery.data.premium.subscription.currentPeriodEnd).toLocaleDateString()}`
                : "No active managed subscription yet."}
            </p>
            <p className="text-xs text-slate-500">Add-ons active: {billingQuery.data?.entitlements.length ?? 0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => billingPortalMutation.mutate()} disabled={billingPortalMutation.isPending || !billingQuery.data?.premium.subscription}>
              {billingPortalMutation.isPending ? "Opening Portal..." : "Manage Billing"}
            </Button>
            <Link href="/pricing" className="inline-flex h-11 items-center rounded-full border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-700 hover:bg-amber-100">
              Open Pricing
            </Link>
          </div>
        </div>

        <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="nexus-panel rounded-[20px] border border-slate-900/10 bg-white/85 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700">Identity Matrix</p>
                <p className="mt-1 text-sm text-slate-600">Refine your public identity, presence layer, and current activity feed.</p>
              </div>
              <div className="rounded-full border border-slate-900/10 bg-slate-50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Live draft
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Username" value={form.username} onChange={(e) => updateDraft("username", e.target.value)} />
              <Input label="Clan Tag" value={form.clanTag} onChange={(e) => updateDraft("clanTag", e.target.value)} />
              <Input label="Avatar URL" value={form.avatar} onChange={(e) => updateDraft("avatar", e.target.value)} />
              <Input label="Banner URL" value={form.banner} onChange={(e) => updateDraft("banner", e.target.value)} />
              <Input label="Current Activity" value={form.currentActivity} onChange={(e) => updateDraft("currentActivity", e.target.value)} />
              <Input label="Activity Details" value={form.activityDetails} onChange={(e) => updateDraft("activityDetails", e.target.value)} />
              <label className="grid gap-2 text-sm text-slate-600 md:col-span-2">
                <span className="font-medium tracking-wide text-slate-700">Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => updateDraft("bio", e.target.value)}
                  className="min-h-28 rounded-[14px] border border-slate-900/10 bg-slate-50 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Tell the community about you"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-600 md:col-span-2">
                <span className="font-medium tracking-wide text-slate-700">Presence</span>
                <select
                  value={form.status}
                  onChange={(e) => updateDraft("status", e.target.value as PresenceStatus)}
                  aria-label="Select presence status"
                  title="Select presence status"
                  className="h-11 rounded-[14px] border border-slate-900/10 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="ONLINE">Online</option>
                  <option value="IDLE">Idle</option>
                  <option value="DND">Do Not Disturb</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="nexus-signal-rail rounded-[16px] border border-slate-900/10 bg-slate-50 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Profile Workspace</p>
              <p className="mt-2 text-sm text-slate-600">Edit identity and presence details below. Changes apply immediately after save.</p>
            </div>

            <div className="nexus-metric-card rounded-[16px] border border-slate-900/10 bg-white/90 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Quick Summary</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-[12px] border border-slate-900/10 bg-slate-50 px-3 py-2">
                  <span>Presence</span>
                  <span className="text-amber-700">{form.status}</span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] border border-slate-900/10 bg-slate-50 px-3 py-2">
                  <span>Branding Kit</span>
                  <span className={hasBrandingKit || isBetaCosmeticsBypass ? "text-amber-700" : "text-amber-700"}>
                    {hasBrandingKit ? "Unlocked" : isBetaCosmeticsBypass ? "Beta Override" : "Locked"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] border border-slate-900/10 bg-slate-50 px-3 py-2">
                  <span>Push Status</span>
                  <span className="text-slate-700">{pushState === "idle" ? "Standby" : "Updated"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {cosmeticUpsellVisible ? (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Premium cosmetics</p>
            <p className="mt-2">Custom avatar and banner identity require the Team Branding Kit entitlement.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/pricing" className="inline-flex h-10 items-center rounded-full border border-amber-300 bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                Unlock Team Branding Kit
              </Link>
              <Link href="/core-plus" className="inline-flex h-10 items-center rounded-full border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-700 hover:bg-amber-100">
                Review Billing
              </Link>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-900/10 pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
          <Button variant="ghost" onClick={() => void enablePush()} disabled={savingPush}>
            {savingPush ? "Preparing..." : "Enable Push"}
          </Button>
        </div>

        {pushState ? <p className="text-xs text-amber-700">{pushState}</p> : null}
        {saveErrorMessage ? <p className="text-xs text-amber-700">{saveErrorMessage}</p> : null}
        {billingPortalMutation.error ? <p className="text-xs text-amber-700">Billing portal is unavailable until an active Stripe customer record exists.</p> : null}
      </div>
    </>
  );
}

