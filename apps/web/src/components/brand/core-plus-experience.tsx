"use client";

import axios from "axios";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmCheckout, createCheckoutSession, createPortalSession, getBillingEntitlements, getBillingPlans, getBillingReadiness, type PlanInfo } from "@/lib/api";
import { PREVIOUS_TIER, megabytes, perksFor } from "@/lib/plan-perks";
import { CORE_PLUS_TIER_PRICING, type CorePlusTier } from "@/lib/pricing-catalog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

const tierCheckoutMeta = {
  CORE: {
    label: CORE_PLUS_TIER_PRICING.CORE.label,
    monthly: CORE_PLUS_TIER_PRICING.CORE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.CORE.yearly,
    savings: `${CORE_PLUS_TIER_PRICING.CORE.yearlySavings} yearly`,
    outcome: "Best for players upgrading identity and access without overspending.",
  },
  PLUS: {
    label: CORE_PLUS_TIER_PRICING.PLUS.label,
    monthly: CORE_PLUS_TIER_PRICING.PLUS.monthly,
    yearly: CORE_PLUS_TIER_PRICING.PLUS.yearly,
    savings: `${CORE_PLUS_TIER_PRICING.PLUS.yearlySavings} yearly`,
    outcome: "Best value for active squads, daily users, and fast-growing forges.",
  },
  ELITE: {
    label: CORE_PLUS_TIER_PRICING.ELITE.label,
    monthly: CORE_PLUS_TIER_PRICING.ELITE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.ELITE.yearly,
    savings: `${CORE_PLUS_TIER_PRICING.ELITE.yearlySavings} yearly`,
    outcome: "Built for creators turning events and campaigns into real growth.",
  },
  INFINITE: {
    label: CORE_PLUS_TIER_PRICING.INFINITE.label,
    monthly: CORE_PLUS_TIER_PRICING.INFINITE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.INFINITE.yearly,
    savings: `${CORE_PLUS_TIER_PRICING.INFINITE.yearlySavings} yearly`,
    outcome: "Maximum power for premium brands, top leagues, and high-volume ops.",
  },
} as const;

const boostTierLogoSet = [
  { id: "CORE", label: "Starter Core", src: "/brand/tier-starter-core.png" },
  { id: "PLUS", label: "Plus Command", src: "/brand/tier-plus-command.png" },
  { id: "ELITE", label: "Elite Creator", src: "/brand/tier-elite-creator.png" },
  { id: "INFINITE", label: "Infinite League", src: "/brand/tier-infinite-league.png" },
] as const;

const tierLogoById = Object.fromEntries(boostTierLogoSet.map((tier) => [tier.id, tier])) as Record<
  CorePlusTier,
  (typeof boostTierLogoSet)[number]
>;

const checkoutAssurances = [
  "Redirects to secure checkout instantly",
  "Subscription activates automatically after payment",
  "Billing can be changed later in the portal",
];

const portalAssurances = [
  "Update payment methods",
  "Switch plans later",
  "Cancel without losing historical billing visibility",
];

export function CorePlusExperience({ checkoutState, checkoutSessionId }: { checkoutState?: string; checkoutSessionId?: string }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user, fetchMe } = useAuthStore();
  // Back from Stripe: confirm the payment with the server (works without Stripe's webhook).
  const confirmQuery = useQuery({
    queryKey: ["checkout-confirm", checkoutSessionId, accessToken],
    queryFn: async () => {
      const result = await confirmCheckout(accessToken!, csrfToken!, checkoutSessionId!);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["billing-entitlements"] }), fetchMe()]);
      return result;
    },
    enabled: checkoutState === "success" && Boolean(checkoutSessionId && accessToken && csrfToken),
    retry: 2,
    retryDelay: 2500,
    staleTime: Infinity,
  });
  const [selectedTier, setSelectedTier] = useState<CorePlusTier>("PLUS");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const entitlementsQuery = useQuery({
    queryKey: ["billing-entitlements", accessToken],
    queryFn: () => getBillingEntitlements(accessToken!),
    enabled: Boolean(accessToken),
  });

  const billingStatusQuery = useQuery({
    queryKey: ["billing-readiness"],
    queryFn: getBillingReadiness,
    staleTime: 30_000,
    retry: false,
  });

  const activationMutation = useMutation({
    mutationFn: () => createCheckoutSession(accessToken!, csrfToken!, {
      featureCode: "CORE_PLUS",
      tier: selectedTier,
      interval: billingInterval,
      quantity: 1,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["core-plus-telemetry", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["billing-entitlements", accessToken] });
      if (result.url) {
        window.location.assign(result.url);
      }
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => createPortalSession(accessToken!, csrfToken!),
    onSuccess: (result) => {
      if (result.url) {
        window.location.assign(result.url);
      }
    },
  });

  const membershipTone =
    user?.premiumTier === "INFINITE"
      ? "border-fuchsia-400/55 bg-fuchsia-950/25 text-fuchsia-100"
      : user?.premiumTier === "ELITE"
        ? "border-amber-400/55 bg-amber-950/25 text-amber-100"
        : user?.premiumTier === "PLUS"
          ? "border-amber-400/60 bg-amber-950/35 text-amber-100"
          : user?.premiumTier === "CORE"
            ? "border-amber-400/55 bg-amber-950/25 text-amber-100"
            : "border-white/10 bg-[#0d1119] text-slate-300";

  const selectedPlan = tierCheckoutMeta[selectedTier];
  const plansQuery = useQuery({ queryKey: ["billing-plans"], queryFn: getBillingPlans, staleTime: 5 * 60_000 });
  const planByTier = Object.fromEntries((plansQuery.data?.plans ?? []).map((plan) => [plan.tier, plan])) as Record<string, PlanInfo | undefined>;
  const tierLimits = planByTier[selectedTier];
  const tierPerks = perksFor(tierLimits, planByTier[PREVIOUS_TIER[selectedTier]]);
  const displayedPrice = billingInterval === "YEARLY" ? selectedPlan.yearly : selectedPlan.monthly;
  const displayedPriceSuffix = billingInterval === "YEARLY" ? "per year" : "per month";
  const activationCta = activationMutation.isPending ? "Securing checkout..." : `Upgrade to ${selectedPlan.label}`;
  const billing = billingStatusQuery.data?.billing ?? null;
  const billingReady = billing?.ready ?? false;
  const missingTierPrices = billing?.missing.tierPrices ?? [];
  const missingAddOnPrices = billing?.missing.addOnPrices ?? [];
  // Customers get a plain message; the setup details are only for staff.
  const billingStatusMessage = !billingReady
    ? billing
      ? "Purchases aren't open yet. Everything is free to use while we finish setting up payments."
      : "Checking billing..."
    : null;
  const billingStatusDetail = !billingReady && billing && user?.isAdmin
    ? [
        !billing.configured.stripeSecretKey ? "Missing STRIPE_SECRET_KEY" : null,
        missingTierPrices.length ? `Missing tier IDs: ${missingTierPrices.slice(0, 4).join(", ")}${missingTierPrices.length > 4 ? "..." : ""}` : null,
        missingAddOnPrices.length ? `Missing add-on IDs: ${missingAddOnPrices.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : null;
  const activationErrorMessage = axios.isAxiosError(activationMutation.error)
    ? ((activationMutation.error.response?.data as { error?: string } | undefined)?.error ?? activationMutation.error.message)
    : activationMutation.error instanceof Error
      ? activationMutation.error.message
      : "Couldn't start checkout. Please try again in a moment.";
  const portalErrorMessage = axios.isAxiosError(portalMutation.error)
    ? ((portalMutation.error.response?.data as { error?: string } | undefined)?.error ?? portalMutation.error.message)
    : portalMutation.error instanceof Error
      ? portalMutation.error.message
      : "Portal unavailable. You may not have an active customer record yet.";

  return (
    <section className="mx-auto grid w-full max-w-[1300px] gap-4 py-8 lg:grid-cols-[1.2fr_1fr]">
      {activationMutation.isPending ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-700/35 px-4 backdrop-blur-md"
        >
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#11151e] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">Preparing Core+ checkout</p>
            <h3 className="mt-3 font-[family-name:var(--font-orbitron)] text-2xl text-white">{selectedPlan.label}</h3>
            <p className="mt-2 text-sm text-slate-400">Nexus Forge Gaming is building a secure checkout session with your selected billing cadence and premium access package.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tier</p>
                <p className="mt-1 text-sm font-semibold text-white">{selectedPlan.label}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Billing</p>
                <p className="mt-1 text-sm font-semibold text-white">{billingInterval === "YEARLY" ? "Yearly lock-in" : "Monthly flexibility"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Price</p>
                <p className="mt-1 text-sm font-semibold text-amber-300">{displayedPrice}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-300 via-amber-300 to-amber-300"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">Do not close the page while Core+ hands off to secure billing.</p>
          </div>
        </motion.div>
      ) : null}
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-[28px] border border-white/10 bg-[#11151e] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:p-7 lg:col-span-2"
      >
        <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-amber-500/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-[-90px] h-64 w-64 rounded-full bg-amber-500/18 blur-3xl" />
        {checkoutState === "success" ? (
          <div className="nexus-display-panel mb-3 rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            {confirmQuery.isSuccess
              ? `Payment confirmed. You're on ${confirmQuery.data.premiumTier === "NONE" ? "Core+" : confirmQuery.data.premiumTier.charAt(0) + confirmQuery.data.premiumTier.slice(1).toLowerCase()} now. Thank you!`
              : confirmQuery.isError
                ? "We couldn't confirm the payment yet. If you were charged, refresh this page in a minute; your plan switches on as soon as Stripe confirms."
                : "Payment received. Switching your plan on…"}
          </div>
        ) : null}
        {checkoutState === "cancelled" ? (
          <div className="nexus-display-panel mb-3 rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Checkout canceled. No subscription changes were made.
          </div>
        ) : null}
        <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">Core+ Membership Program</p>
        <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white sm:text-5xl">
          More room for the players who need it.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
          Core+ raises your limits: bigger uploads, longer messages, more servers and, from Plus up, ultra-quality
          video. HD video, profile banners and animated avatars are already free for everyone.
        </p>

        <div className="nexus-panel-glass mt-6 rounded-[28px] border border-white/10 bg-[#11151e] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Core+ Snapshot</p>
              <p className="mt-2 text-sm text-slate-400">Selected tier, billing cadence, and current membership posture at a glance.</p>
            </div>
            <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-amber-200">
              {billingReady ? "Checkout ready" : "Billing status pending"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Selected tier</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedPlan.label}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Billing cadence</p>
              <p className="mt-2 text-lg font-semibold text-white">{displayedPriceSuffix}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Tier outcome</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedPlan.outcome}</p>
            </div>
          </div>
        </div>

        {billingStatusMessage ? (
          <div className="nexus-display-panel mt-4 rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p>{billingStatusMessage}</p>
            {billingStatusDetail ? <p className="mt-2 text-[11px] text-amber-700/90">{billingStatusDetail}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="glass-cut rounded-[22px] border border-white/10 bg-[#11151e] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300">Uploads</p>
            <p className="mt-1 text-sm font-semibold text-white">{tierLimits ? `Up to ${megabytes(tierLimits.uploadBytes)}` : "…"}</p>
          </div>
          <div className="glass-cut rounded-[22px] border border-white/10 bg-[#11151e] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300">Servers</p>
            <p className="mt-1 text-sm font-semibold text-white">{tierLimits ? `Up to ${tierLimits.maxServers}` : "…"}</p>
          </div>
          <div className="glass-cut rounded-[22px] border border-white/10 bg-[#11151e] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300">Video</p>
            <p className="mt-1 text-sm font-semibold text-white">{tierLimits ? (tierLimits.ultraVideo ? "Ultra (1440p60)" : "HD") : "…"}</p>
          </div>
        </div>

        <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${membershipTone}`}>
          <span className="font-semibold">Membership:</span>
          <span>{user?.premium ? user.premiumTier ?? "CORE" : "NONE"}</span>
          <span className="text-[11px] opacity-85">Boost {user?.corePlusBoostLevel ?? 0}</span>
          <span className="text-[11px] opacity-85">Streak {user?.corePlusStreakDays ?? 0}d</span>
        </div>
        {entitlementsQuery.data?.premium.subscription ? (
          <p className="mt-2 text-xs text-slate-300">
            Billing: {entitlementsQuery.data.premium.subscription.interval} · {entitlementsQuery.data.premium.subscription.status}
            {entitlementsQuery.data.premium.subscription.currentPeriodEnd
              ? ` · renews ${new Date(entitlementsQuery.data.premium.subscription.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No active subscription found. Start with a tier below.</p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {tierPerks.map((perk, index) => (
            <motion.div
              key={perk}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 + index * 0.07, ease: "easeOut" }}
              className="nexus-metric-card nexus-interactive-card rounded-[22px] border border-white/10 bg-[#11151e] p-3"
            >
              <p className="text-sm font-semibold text-white">{perk}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <select
            value={selectedTier}
            onChange={(event) => setSelectedTier(event.target.value as CorePlusTier)}
            aria-label="Select Core Plus tier"
            title="Select Core Plus tier"
            className="h-10 rounded-full border border-white/10 bg-[#11151e] px-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="CORE">Core</option>
            <option value="PLUS">Plus</option>
            <option value="ELITE">Elite</option>
            <option value="INFINITE">Infinite</option>
          </select>
          <select
            value={billingInterval}
            onChange={(event) => setBillingInterval(event.target.value as "MONTHLY" | "YEARLY")}
            aria-label="Select billing interval"
            title="Select billing interval"
            className="h-10 rounded-full border border-white/10 bg-[#11151e] px-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <Button
            onClick={() => activationMutation.mutate()}
            disabled={!accessToken || !csrfToken || activationMutation.isPending || !billingReady}
            className="h-10 rounded-full border-amber-300 bg-[linear-gradient(180deg,rgba(159,216,255,1),rgba(99,192,255,0.96)_45%,rgba(30,139,255,0.96))] px-4 text-sm text-white shadow-[0_16px_30px_rgba(30,139,255,0.26)]"
          >
            {activationCta}
          </Button>
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={!accessToken || !csrfToken || portalMutation.isPending || !billingReady}
            variant="ghost"
            className="h-10 rounded-full border-amber-500/35 px-4 text-sm text-amber-200"
          >
            {portalMutation.isPending ? "Opening portal..." : "Manage Billing"}
          </Button>
          <Link
            href="/app"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-full border border-white/10 bg-[#11151e] px-4 text-sm font-semibold text-white hover:border-amber-300"
          >
            Return to workspace
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Available tiers:</span>
          {(Object.entries(tierCheckoutMeta) as Array<[CorePlusTier, (typeof tierCheckoutMeta)["CORE"]]>).map(
            ([tierKey, tier]) => (
              <span
                key={tierKey}
                className={`rounded-full border px-2.5 py-1 ${
                  selectedTier === tierKey
                    ? "border-amber-400/55 bg-amber-500/10 text-amber-200"
                    : "border-white/10 bg-[#11151e] text-slate-400"
                }`}
              >
                {tier.label}
              </span>
            ),
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="nexus-display-panel rounded-[28px] border border-white/10 bg-[#11151e] p-4">
            <div className="mb-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1119]">
              <Image
                src={tierLogoById[selectedTier].src}
                alt={`${selectedPlan.label} tier artwork`}
                width={1200}
                height={800}
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Selected Plan</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedPlan.label}</p>
                <p className="mt-1 text-sm text-slate-400">{selectedPlan.outcome}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{displayedPrice}</p>
                <p className="text-xs text-slate-500">{displayedPriceSuffix}</p>
              </div>
            </div>
            <div className="mt-3 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              {selectedPlan.savings}
            </div>
          </div>
          <div className="nexus-display-panel rounded-[28px] border border-white/10 bg-[#11151e] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Checkout Summary</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>• Tier: {selectedPlan.label}</li>
              <li>• Billing: {billingInterval === "YEARLY" ? "Yearly lock-in" : "Monthly flexibility"}</li>
              <li>• Price: {displayedPrice} {displayedPriceSuffix}</li>
            </ul>
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs text-slate-500">
              {checkoutAssurances.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
            <div className="mt-3 rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300">Billing portal later</p>
              <div className="mt-2 space-y-1 text-xs text-slate-400">
                {portalAssurances.map((item) => (
                  <p key={item}>• {item}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
        {activationMutation.error ? (
          <p className="mt-2 text-xs text-red-300">Checkout failed: {activationErrorMessage}</p>
        ) : null}
        {portalMutation.error ? (
          <p className="mt-1 text-xs text-red-300">Portal unavailable: {portalErrorMessage}</p>
        ) : null}
      </motion.article>

    </section>
  );
}

