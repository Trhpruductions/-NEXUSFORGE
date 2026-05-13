"use client";

import axios from "axios";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCheckoutSession, createPortalSession, getBillingEntitlements, getBillingReadiness } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

const perkRows = [
  { title: "Forge Priority Routing", detail: "Low-latency queue lane for voice and stream operations." },
  { title: "Core+ Identity Card", detail: "Animated profile card and premium account presentation." },
  { title: "Boost Tier Multipliers", detail: "Progressive rewards for weekly activity and events." },
  { title: "Creator Launch Kit", detail: "Early access to sponsor surfaces and campaign slots." },
];

const tierCheckoutMeta = {
  CORE: {
    label: "Starter Core",
    monthly: "$4.99",
    yearly: "$48",
    savings: "Save 20% yearly",
    outcome: "Best for players upgrading identity and access without overspending.",
  },
  PLUS: {
    label: "Plus Command",
    monthly: "$11.99",
    yearly: "$108",
    savings: "2 months free on yearly",
    outcome: "Best value for active squads, daily users, and fast-growing forges.",
  },
  ELITE: {
    label: "Elite Creator",
    monthly: "$24.99",
    yearly: "$228",
    savings: "Save 24% yearly",
    outcome: "Built for creators turning events and campaigns into real growth.",
  },
  INFINITE: {
    label: "Infinite League",
    monthly: "$44.99",
    yearly: "$420",
    savings: "Save 22% yearly",
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
  "CORE" | "PLUS" | "ELITE" | "INFINITE",
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

export function CorePlusExperience({ checkoutState }: { checkoutState?: string }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState<"CORE" | "PLUS" | "ELITE" | "INFINITE">("PLUS");
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
        ? "border-emerald-400/55 bg-emerald-950/25 text-emerald-100"
        : user?.premiumTier === "PLUS"
          ? "border-amber-400/60 bg-amber-950/35 text-amber-100"
          : user?.premiumTier === "CORE"
            ? "border-cyan-400/55 bg-cyan-950/25 text-cyan-100"
            : "border-slate-500/55 bg-slate-900/60 text-slate-200";

  const selectedPlan = tierCheckoutMeta[selectedTier];
  const displayedPrice = billingInterval === "YEARLY" ? selectedPlan.yearly : selectedPlan.monthly;
  const displayedPriceSuffix = billingInterval === "YEARLY" ? "per year" : "per month";
  const activationCta = activationMutation.isPending ? "Securing checkout..." : `Upgrade to ${selectedPlan.label}`;
  const billing = billingStatusQuery.data?.billing ?? null;
  const billingReady = billing?.ready ?? false;
  const missingTierPrices = billing?.missing.tierPrices ?? [];
  const missingAddOnPrices = billing?.missing.addOnPrices ?? [];
  const billingStatusMessage = !billingReady
    ? billing
      ? `Billing is currently in setup mode. Missing tier prices: ${missingTierPrices.length}; missing add-on prices: ${missingAddOnPrices.length}.`
      : "Checking billing readiness..."
    : null;
  const billingStatusDetail = !billingReady && billing
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
      : "Checkout session creation failed. Verify Stripe config and retry.";
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/82 px-4 backdrop-blur-md"
        >
          <div className="w-full max-w-xl rounded-3xl border border-amber-500/35 bg-slate-950/95 p-6 shadow-[0_24px_80px_rgba(251,191,36,0.18)]">
            <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">Preparing Core+ checkout</p>
            <h3 className="mt-3 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50">{selectedPlan.label}</h3>
            <p className="mt-2 text-sm text-slate-300">NexusForge is building a secure checkout session with your selected billing cadence and premium access package.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tier</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{selectedPlan.label}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Billing</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{billingInterval === "YEARLY" ? "Yearly lock-in" : "Monthly flexibility"}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Price</p>
                <p className="mt-1 text-sm font-semibold text-emerald-200">{displayedPrice}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300"
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">Do not close the page while Core+ hands off to secure billing.</p>
          </div>
        </motion.div>
      ) : null}
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-3xl p-5 sm:p-7 lg:col-span-2"
      >
        <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-[-90px] h-64 w-64 rounded-full bg-amber-500/18 blur-3xl" />
        {checkoutState === "success" ? (
          <div className="nexus-display-panel mb-3 rounded-[24px] p-3 text-sm text-emerald-100">
            Checkout completed. Billing sync is now updating your Core+ access.
          </div>
        ) : null}
        {checkoutState === "cancelled" ? (
          <div className="nexus-display-panel mb-3 rounded-[24px] p-3 text-sm text-amber-100">
            Checkout canceled. No subscription changes were made.
          </div>
        ) : null}
        <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">Core+ Membership Program</p>
        <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-slate-50 sm:text-5xl">
          Premium infrastructure for serious gaming communities.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          Core+ combines visual prestige with operational advantages: queue priority, premium surfaces, and tiered
          progression mechanics tuned for creator-led ecosystems.
        </p>
        {billingStatusMessage ? (
          <div className="nexus-display-panel mt-4 rounded-[20px] border border-amber-500/40 bg-amber-950/25 p-3 text-xs text-amber-100">
            <p>{billingStatusMessage}</p>
            {billingStatusDetail ? <p className="mt-2 text-[11px] text-amber-200/90">{billingStatusDetail}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="glass-cut rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Queue Gain</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">+32% priority lane</p>
          </div>
          <div className="glass-cut rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Visual Tier</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">Premium identity skin</p>
          </div>
          <div className="glass-cut rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Boost Ladder</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">Progressive multipliers</p>
          </div>
        </div>

        <div className={`mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${membershipTone}`}>
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
          {perkRows.map((perk, index) => (
            <motion.div
              key={perk.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 + index * 0.07, ease: "easeOut" }}
              className="nexus-metric-card nexus-interactive-card rounded-2xl border border-slate-700/70 p-3"
            >
              <p className="text-sm font-semibold text-cyan-100">{perk.title}</p>
              <p className="mt-1 text-xs text-slate-400">{perk.detail}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <select
            value={selectedTier}
            onChange={(event) => setSelectedTier(event.target.value as "CORE" | "PLUS" | "ELITE" | "INFINITE")}
            aria-label="Select Core Plus tier"
            title="Select Core Plus tier"
            className="h-10 rounded-xl border border-amber-500/45 bg-[linear-gradient(155deg,rgba(120,53,15,0.22),rgba(15,23,42,0.88))] px-3 text-sm text-amber-100 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/20"
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
            className="h-10 rounded-xl border border-cyan-500/45 bg-[linear-gradient(155deg,rgba(8,47,73,0.22),rgba(15,23,42,0.88))] px-3 text-sm text-cyan-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <Button
            onClick={() => activationMutation.mutate()}
            disabled={!accessToken || !csrfToken || activationMutation.isPending || !billingReady}
            className="h-10 rounded-xl border-amber-300 bg-[linear-gradient(180deg,rgba(253,230,138,1),rgba(252,211,77,0.96)_45%,rgba(245,158,11,0.96))] px-4 text-sm text-slate-950 shadow-[0_16px_30px_rgba(245,158,11,0.26)]"
          >
            {activationCta}
          </Button>
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={!accessToken || !csrfToken || portalMutation.isPending || !billingReady}
            variant="ghost"
            className="h-10 rounded-xl border-emerald-500/35 px-4 text-sm text-emerald-100"
          >
            {portalMutation.isPending ? "Opening portal..." : "Manage Billing"}
          </Button>
          <Link
            href="/app"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-cyan-500/35 bg-[linear-gradient(155deg,rgba(8,47,73,0.24),rgba(15,23,42,0.9))] px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
          >
            Return to Command Center
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Available tiers:</span>
          {(Object.entries(tierCheckoutMeta) as Array<["CORE" | "PLUS" | "ELITE" | "INFINITE", (typeof tierCheckoutMeta)["CORE"]]>).map(
            ([tierKey, tier]) => (
              <span
                key={tierKey}
                className={`rounded-full border px-2.5 py-1 ${
                  selectedTier === tierKey
                    ? "border-amber-400/55 bg-amber-950/35 text-amber-100"
                    : "border-slate-700/80 bg-slate-900/60 text-slate-300"
                }`}
              >
                {tier.label}
              </span>
            ),
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="nexus-display-panel rounded-[24px] p-4">
            <div className="mb-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/65">
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
                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Selected Plan</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">{selectedPlan.label}</p>
                <p className="mt-1 text-sm text-slate-300">{selectedPlan.outcome}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-slate-50">{displayedPrice}</p>
                <p className="text-xs text-slate-400">{displayedPriceSuffix}</p>
              </div>
            </div>
            <div className="mt-3 inline-flex rounded-full border border-emerald-500/35 bg-emerald-950/25 px-3 py-1 text-xs text-emerald-100">
              {selectedPlan.savings}
            </div>
          </div>
          <div className="nexus-display-panel rounded-[24px] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Checkout Summary</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>• Tier: {selectedPlan.label}</li>
              <li>• Billing: {billingInterval === "YEARLY" ? "Yearly lock-in" : "Monthly flexibility"}</li>
              <li>• Price: {displayedPrice} {displayedPriceSuffix}</li>
            </ul>
            <div className="mt-3 space-y-2 border-t border-slate-800 pt-3 text-xs text-slate-400">
              {checkoutAssurances.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
            <div className="mt-3 rounded-[20px] border border-emerald-500/20 bg-emerald-950/15 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Billing portal later</p>
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
