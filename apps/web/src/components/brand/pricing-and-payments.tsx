"use client";

import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createCheckoutSession, getBillingPlans, getBillingReadiness, type PaidFeatureCode, type PlanInfo } from "@/lib/api";
import { megabytes, PREVIOUS_TIER, perksFor } from "@/lib/plan-perks";
import { CORE_PLUS_TIER_PRICING } from "@/lib/pricing-catalog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

const tierCards = [
  {
    id: "CORE",
    name: CORE_PLUS_TIER_PRICING.CORE.label,
    monthly: CORE_PLUS_TIER_PRICING.CORE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.CORE.yearly,
    yearlySavings: CORE_PLUS_TIER_PRICING.CORE.yearlySavings,
    tone: "border-amber-500/45 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "Best entry",
    description: "For players who want premium identity without overcommitting.",
    cta: "Start Core",
  },
  {
    id: "PLUS",
    name: CORE_PLUS_TIER_PRICING.PLUS.label,
    monthly: CORE_PLUS_TIER_PRICING.PLUS.monthly,
    yearly: CORE_PLUS_TIER_PRICING.PLUS.yearly,
    yearlySavings: CORE_PLUS_TIER_PRICING.PLUS.yearlySavings,
    tone: "border-amber-500/50 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "Most popular",
    description: "For active squads, creators and growing servers.",
    cta: "Upgrade to Plus",
    spotlight: true,
  },
  {
    id: "ELITE",
    name: CORE_PLUS_TIER_PRICING.ELITE.label,
    monthly: CORE_PLUS_TIER_PRICING.ELITE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.ELITE.yearly,
    yearlySavings: CORE_PLUS_TIER_PRICING.ELITE.yearlySavings,
    tone: "border-amber-500/45 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "For creators",
    description: "For creators and communities that run events and sponsorships.",
    cta: "Go Elite",
  },
  {
    id: "INFINITE",
    name: CORE_PLUS_TIER_PRICING.INFINITE.label,
    monthly: CORE_PLUS_TIER_PRICING.INFINITE.monthly,
    yearly: CORE_PLUS_TIER_PRICING.INFINITE.yearly,
    yearlySavings: CORE_PLUS_TIER_PRICING.INFINITE.yearlySavings,
    tone: "border-fuchsia-500/45 bg-fuchsia-950/30 text-fuchsia-100",
    accent: "text-fuchsia-200",
    badge: "Largest limits",
    description: "For esports hubs, brands and large community teams.",
    cta: "Unlock Infinite",
  },
];

const boostTierLogos = [
  { id: "CORE", label: "Starter Core", src: "/brand/tier-starter-core.png" },
  { id: "PLUS", label: "Plus Command", src: "/brand/tier-plus-command.png" },
  { id: "ELITE", label: "Elite Creator", src: "/brand/tier-elite-creator.png" },
  { id: "INFINITE", label: "Infinite League", src: "/brand/tier-infinite-league.png" },
] as const;

const tierLogoById = Object.fromEntries(boostTierLogos.map((tier) => [tier.id, tier])) as Record<
  "CORE" | "PLUS" | "ELITE" | "INFINITE",
  (typeof boostTierLogos)[number]
>;

const checkoutPreviewCopy: Record<PaidFeatureCode, { label: string; detail: string }> = {
  CORE_PLUS: {
    label: "Core+ tier upgrade",
    detail: "Your selected membership tier, billing interval, and premium perks are being prepared for checkout.",
  },
  FORGE_BOOST_PACK: {
    label: "Forge Boost Pack",
    detail: "Momentum boosts, spotlight pressure, and faster growth unlocks are being staged for purchase.",
  },
  CREATOR_CAMPAIGN_SLOT: {
    label: "Creator Campaign Slot",
    detail: "Featured placement inventory and campaign discovery rails are being reserved for this checkout.",
  },
  EVENT_TICKET_PASS: {
    label: "Event Ticket Pass",
    detail: "Premium event access and gated reward rails are being prepared for secure checkout.",
  },
  TEAM_BRANDING_KIT: {
    label: "Team Branding Kit",
    detail: "Identity art, badge assets, and premium profile cosmetics are being bundled for payment.",
  },
  ADVANCED_MODERATION_AI: {
    label: "Activity pressure",
    detail: "A rough activity score with suggested next steps for staff.",
  },
};

export function PricingAndPayments({ checkoutState }: { checkoutState?: string }) {
  const { accessToken, csrfToken, user } = useAuthStore();
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [pendingCheckout, setPendingCheckout] = useState<{ featureCode: PaidFeatureCode; tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE" } | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: (payload: {
      featureCode: PaidFeatureCode;
      tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE";
      interval?: "MONTHLY" | "YEARLY";
      quantity?: number;
    }) => createCheckoutSession(accessToken!, csrfToken!, payload),
    onSuccess: (result) => {
      if (result.url) {
        window.location.assign(result.url);
      }
    },
    onError: () => {
      setPendingCheckout(null);
    },
  });

  const plansQuery = useQuery({ queryKey: ["billing-plans"], queryFn: getBillingPlans, staleTime: 5 * 60_000 });
  const planByTier = Object.fromEntries((plansQuery.data?.plans ?? []).map((plan) => [plan.tier, plan])) as Record<string, PlanInfo>;
  const billingStatusQuery = useQuery({
    queryKey: ["billing-readiness"],
    queryFn: getBillingReadiness,
    staleTime: 30_000,
    retry: false,
  });

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

  const handleCheckout = (payload: {
    featureCode: PaidFeatureCode;
    tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE";
    quantity?: number;
  }) => {
    if (!accessToken || !csrfToken) {
      window.location.assign("/login");
      return;
    }

    setPendingCheckout({ featureCode: payload.featureCode, tier: payload.tier });
    checkoutMutation.mutate({
      ...payload,
      interval: payload.featureCode === "CORE_PLUS" ? interval : undefined,
    });
  };

  const checkoutPreview = pendingCheckout ? checkoutPreviewCopy[pendingCheckout.featureCode] : null;
  const pendingTierName = pendingCheckout?.tier ? tierCards.find((tier) => tier.id === pendingCheckout.tier)?.name : null;
  const pendingBillingLabel = pendingCheckout?.featureCode === "CORE_PLUS" ? interval : "One-time";
  const checkoutErrorMessage = axios.isAxiosError(checkoutMutation.error)
    ? ((checkoutMutation.error.response?.data as { error?: string } | undefined)?.error ?? checkoutMutation.error.message)
    : checkoutMutation.error instanceof Error
      ? checkoutMutation.error.message
      : null;

  return (
    <section className="grid gap-4">
      {checkoutMutation.isPending && checkoutPreview ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-700/35 px-4 backdrop-blur-md"
        >
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0d1119] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-amber-300">Launching secure checkout</p>
            <h3 className="mt-3 font-[family-name:var(--font-orbitron)] text-2xl text-white">{checkoutPreview.label}</h3>
            <p className="mt-2 text-sm text-slate-400">{checkoutPreview.detail}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tier</p>
                <p className="mt-1 text-sm font-semibold text-white">{pendingTierName ?? "One-time purchase"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Billing</p>
                <p className="mt-1 text-sm font-semibold text-white">{pendingBillingLabel}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#0d1119] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-amber-300">Redirecting now</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-300"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">Do not close the page. Nexus Forge Gaming is securing your checkout session and handing off to billing.</p>
          </div>
        </motion.div>
      ) : null}
      {checkoutState === "success" ? (
        <div className="nexus-display-panel rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Payment completed. Your subscription or entitlement is being activated now.
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="nexus-display-panel rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Checkout was canceled. Your current access remains unchanged.
        </div>
      ) : null}

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-[28px] border border-white/10 bg-[#11151e] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:p-7"
      >
        <div className="pointer-events-none absolute -left-14 top-[-70px] h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-[-70px] h-56 w-56 rounded-full bg-amber-500/12 blur-3xl" />

        <p className="text-[11px] uppercase tracking-[0.26em] text-amber-300">Pricing</p>
        <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-white sm:text-4xl">
          Every plan includes the full app.
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">
          Paid plans raise your upload size, server count and video quality. Pay monthly, or save with yearly billing.
        </p>
        {billingStatusMessage ? (
          <div className="nexus-display-panel mt-4 rounded-[22px] border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p>{billingStatusMessage}</p>
            {billingStatusDetail ? <p className="mt-2 text-[11px] text-amber-700/90">{billingStatusDetail}</p> : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#11151e] px-3 py-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Billing Interval</span>
            <Button
              onClick={() => setInterval("MONTHLY")}
              variant="ghost"
              className={`h-8 rounded-full px-3 text-xs ${interval === "MONTHLY" ? "border-amber-500/55 text-amber-700" : "text-slate-500"}`}
            >
              Monthly
            </Button>
            <Button
              onClick={() => setInterval("YEARLY")}
              variant="ghost"
              className={`h-8 rounded-full px-3 text-xs ${interval === "YEARLY" ? "border-amber-500/55 text-amber-700" : "text-slate-500"}`}
            >
              Yearly
            </Button>
          </div>
          <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
            {interval === "YEARLY" ? "Billed once a year" : "Billed monthly, cancel any time"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {tierCards.map((tier, index) => (
            <motion.article
              key={tier.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
              className={`nexus-interactive-card rounded-[28px] border bg-[#11151e] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ${tier.spotlight ? "border-amber-400/40 shadow-[0_18px_50px_rgba(99,192,255,0.12)]" : "border-white/10"}`}
            >
              <div className="mb-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1119]">
                <Image
                  src={tierLogoById[tier.id as "CORE" | "PLUS" | "ELITE" | "INFINITE"].src}
                  alt={`${tier.name} tier artwork`}
                  width={1200}
                  height={800}
                  className="h-auto w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-full border border-white/10 bg-[#11151e] px-2 py-0.5 text-[11px] text-slate-300">{tier.name}</div>
                <div className="text-[11px] font-semibold text-amber-300">{tier.badge}</div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{tier.description}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-3xl font-semibold text-white">{interval === "YEARLY" ? tier.yearly : tier.monthly}</p>
                <p className="pb-1 text-xs text-slate-500">{interval === "YEARLY" ? "per year" : "per month"}</p>
              </div>
              <p className="mt-1 text-xs text-amber-300">{tier.yearlySavings}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
                {perksFor(planByTier[tier.id], planByTier[PREVIOUS_TIER[tier.id]]).map((perk) => (
                  <li key={perk}>• {perk}</li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout({ featureCode: "CORE_PLUS", tier: tier.id as "CORE" | "PLUS" | "ELITE" | "INFINITE" })}
                disabled={checkoutMutation.isPending || !billingReady}
                className={`mt-4 h-10 w-full rounded-full px-3 text-xs ${tier.spotlight ? "border-amber-300 bg-[linear-gradient(180deg,rgba(159,216,255,1),rgba(99,192,255,0.96)_45%,rgba(30,139,255,0.96))] text-white shadow-[0_16px_30px_rgba(30,139,255,0.16)]" : "border-white/10 bg-[#11151e] text-white"}`}
              >
                {checkoutMutation.isPending ? "Opening..." : tier.cta}
              </Button>
              <p className="mt-2 text-center text-[11px] text-slate-500">Instant activation after successful payment</p>
            </motion.article>
          ))}
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.04 }}
        className="nexus-display-panel rounded-[28px] border border-white/10 bg-[#11151e] p-5 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Tier Comparison</p>
            <h3 className="mt-1 font-[family-name:var(--font-orbitron)] text-xl text-white">Exactly what each plan unlocks.</h3>
          </div>
          <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
            Prices in US dollars
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Feature</th>
                {(plansQuery.data?.plans ?? []).map((plan) => (
                  <th key={plan.tier} className={`py-2 pr-3 font-semibold ${plan.tier === "PLUS" ? "text-amber-200" : ""}`}>{plan.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Upload size", value: (plan: PlanInfo) => `${megabytes(plan.uploadBytes)}` },
                { label: "Message length", value: (plan: PlanInfo) => `${plan.messageLength.toLocaleString()} characters` },
                { label: "Servers you can be in", value: (plan: PlanInfo) => String(plan.maxServers) },
                { label: "Profile banner", value: (plan: PlanInfo) => (plan.profileBanner ? "Yes" : "-") },
                { label: "Animated (GIF) avatar", value: (plan: PlanInfo) => (plan.animatedAvatar ? "Yes" : "-") },
                { label: "Screen share / camera", value: (plan: PlanInfo) => (plan.ultraVideo ? "1440p60 / 1080p" : "1080p30 / 720p") },
              ].map((row) => (
                <tr key={row.label} className="border-b border-white/10 text-slate-400">
                  <td className="py-2 pr-3 font-medium text-white">{row.label}</td>
                  {(plansQuery.data?.plans ?? []).map((plan) => (
                    <td key={`${row.label}-${plan.tier}`} className={`py-2 pr-3 ${plan.tier === "PLUS" ? "text-amber-200" : "text-slate-400"}`}>{row.value(plan)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">During the beta, single uploads are capped at 95 MB while large-file storage is being set up, whatever your plan.</p>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="nexus-display-panel rounded-[28px] border border-white/10 bg-[#11151e] p-5 sm:p-6"
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">How payments work</p>
        <ul className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
          <li>• Card payments are handled by Stripe on its own secure checkout page. Nexus Forge never sees your card number.</li>
          <li>• Your plan starts as soon as the payment goes through.</li>
          <li>• Change or cancel any time from <Link href="/app/settings?section=billing" className="text-amber-200 underline underline-offset-2">Settings → Billing</Link>. Cancelling keeps your plan until the end of the period you paid for.</li>
          <li>• If you cancel at checkout, nothing is charged and nothing changes.</li>
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">See the <Link href="/legal/terms" className="underline underline-offset-2">Terms of Service</Link> for the full terms.</p>
        {checkoutMutation.error ? <p className="mt-2 text-xs text-red-300">Checkout failed: {checkoutErrorMessage}</p> : null}
      </motion.article>
    </section>
  );
}

