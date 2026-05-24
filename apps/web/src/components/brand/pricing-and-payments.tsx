"use client";

import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createCheckoutSession, getBillingReadiness, type PaidFeatureCode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

const tierCards = [
  {
    id: "CORE",
    name: "Starter Core",
    monthly: "$3.99",
    yearly: "$39",
    yearlySavings: "Save 18%",
    tone: "border-amber-500/45 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "Best entry",
    description: "For players who want premium identity without overcommitting.",
    cta: "Start Core",
    perks: ["Animated profile identity", "Faster text priority", "Member analytics starter pack", "Higher upload ceiling"],
  },
  {
    id: "PLUS",
    name: "Plus Command",
    monthly: "$9.99",
    yearly: "$99",
    yearlySavings: "Save 17%",
    tone: "border-amber-500/50 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "Most popular",
    description: "The sweet spot for active squads, creators, and fast-growing forges.",
    cta: "Upgrade to Plus",
    perks: ["Everything in Core", "Voice priority lane", "Boost multiplier x1.5", "Priority support queue", "Premium room cosmetics"],
    spotlight: true,
  },
  {
    id: "ELITE",
    name: "Elite Creator",
    monthly: "$19.99",
    yearly: "$199",
    yearlySavings: "Save 17%",
    tone: "border-amber-500/45 bg-amber-950/30 text-amber-100",
    accent: "text-amber-200",
    badge: "Creator growth",
    description: "Built for communities monetizing events, drops, and sponsor attention.",
    cta: "Go Elite",
    perks: ["Everything in Plus", "Creator campaign slots", "Boost multiplier x2", "Featured promotion priority", "Advanced creator analytics"],
  },
  {
    id: "INFINITE",
    name: "Infinite League",
    monthly: "$39.99",
    yearly: "$399",
    yearlySavings: "Save 17%",
    tone: "border-fuchsia-500/45 bg-fuchsia-950/30 text-fuchsia-100",
    accent: "text-fuchsia-200",
    badge: "Full power",
    description: "Maximum velocity for premium brands, esports hubs, and top-tier community ops.",
    cta: "Unlock Infinite",
    perks: ["Everything in Elite", "White-glove support", "Boost multiplier x3", "Launch concierge help", "Top-priority feature access"],
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

const paidCatalog = [
  {
    item: "Core+ subscription",
    price: "Tier-based monthly or yearly",
    requiredFor: "Premium identity, routing priority, boost scaling, member prestige features",
  },
  {
    item: "Forge Boost Packs",
    price: "$3 / $8 / $19",
    requiredFor: "XP acceleration, spotlight priority, momentum pushes during events",
  },
  {
    item: "Creator Campaign Slot",
    price: "$29 per campaign",
    requiredFor: "Featured placement, audience discovery, premium homepage exposure",
  },
  {
    item: "Event Ticket Pass",
    price: "$2 to $9 per event",
    requiredFor: "Premium tournaments, gated drops, exclusive stage and reward access",
  },
  {
    item: "Team Branding Kit",
    price: "$12 one-time",
    requiredFor: "Custom team badge pack, premium identity art, advanced profile cosmetics",
  },
  {
    item: "Advanced Moderation AI",
    price: "$9 per forge / month",
    requiredFor: "Behavior scoring, raid-shield automation, incident replay intelligence",
  },
];

const trustSignals = [
  "Instant checkout redirect",
  "Manage anytime in billing portal",
  "Card, Apple Pay, Google Pay, PayPal, Crypto",
  "No hidden platform fee surprise",
];

const comparisonRows = [
  {
    label: "Animated profile identity",
    values: ["Included", "Premium skin set", "Creator prestige set", "Signature league set"],
  },
  {
    label: "Priority routing",
    values: ["Lite", "Fast lane", "Faster + creator priority", "Top priority"],
  },
  {
    label: "Voice queue advantage",
    values: ["-", "Included", "Included", "Maximum priority"],
  },
  {
    label: "Boost multiplier",
    values: ["x1.1", "x1.5", "x2", "x3"],
  },
  {
    label: "Creator campaign access",
    values: ["-", "Limited", "Priority", "Priority + concierge"],
  },
  {
    label: "Support lane",
    values: ["Standard", "Priority", "Priority creator lane", "White-glove"],
  },
];

const upgradeOutcomes = [
  {
    title: "Look premium immediately",
    detail: "Profiles, presence, and community identity upgrade the second billing activates.",
  },
  {
    title: "Move faster in live ops",
    detail: "Priority routing and boost advantages make active communities feel sharper right away.",
  },
  {
    title: "Monetize without friction",
    detail: "Campaign slots, event passes, and AI moderation unlock real operational leverage.",
  },
];

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
    label: "Advanced Moderation AI",
    detail: "Behavior intelligence, raid defense, and replay tooling are being provisioned for this forge.",
  },
};

const founderWindowEndsAt = new Date("2026-06-30T23:59:59Z");

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Ended";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export function PricingAndPayments({ checkoutState }: { checkoutState?: string }) {
  const { accessToken, csrfToken } = useAuthStore();
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [pendingCheckout, setPendingCheckout] = useState<{ featureCode: PaidFeatureCode; tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE" } | null>(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [projectedMembers, setProjectedMembers] = useState(250);
  const [projectedAdoptionPct, setProjectedAdoptionPct] = useState(8);
  const [estimatedArpu, setEstimatedArpu] = useState(11.99);

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
  const billingStatusMessage = !billingReady
    ? billing
      ? `Billing is in setup mode. Missing tier prices: ${missingTierPrices.length}; missing add-on prices: ${missingAddOnPrices.length}.`
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const founderCountdown = formatCountdown(founderWindowEndsAt.getTime() - countdownNow);

  const projectedRevenue = useMemo(() => {
    const activePaidMembers = Math.round(projectedMembers * (projectedAdoptionPct / 100));
    const monthly = Math.round(activePaidMembers * estimatedArpu);
    return {
      activePaidMembers,
      monthly,
      annual: monthly * 12,
    };
  }, [estimatedArpu, projectedAdoptionPct, projectedMembers]);

  return (
    <section className="grid gap-4">
      {checkoutMutation.isPending && checkoutPreview ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/82 px-4 backdrop-blur-md"
        >
          <div className="w-full max-w-xl rounded-3xl border border-amber-500/35 bg-slate-950/95 p-6 shadow-[0_24px_80px_rgba(255,184,108,0.18)]">
            <p className="text-[11px] uppercase tracking-[0.26em] text-amber-300">Launching secure checkout</p>
            <h3 className="mt-3 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50">{checkoutPreview.label}</h3>
            <p className="mt-2 text-sm text-slate-300">{checkoutPreview.detail}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tier</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{pendingTierName ?? "One-time purchase"}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Billing</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{pendingBillingLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-amber-200">Redirecting now</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-300"
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">Do not close the page. NexusForge is securing your checkout session and handing off to billing.</p>
          </div>
        </motion.div>
      ) : null}
      {checkoutState === "success" ? (
        <div className="nexus-display-panel rounded-[24px] p-4 text-sm text-amber-100">
          Payment completed. Your subscription or entitlement is being activated now.
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="nexus-display-panel rounded-[24px] p-4 text-sm text-amber-100">
          Checkout was canceled. Your current access remains unchanged.
        </div>
      ) : null}

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-3xl p-5 sm:p-7"
      >
        <div className="pointer-events-none absolute -left-14 top-[-70px] h-52 w-52 rounded-full bg-amber-500/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-[-70px] h-56 w-56 rounded-full bg-amber-500/16 blur-3xl" />

        <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">Pricing + Payments</p>
        <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-4xl">
          Premium tiers that feel worth upgrading into.
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
          Start cheap, scale fast, and make the upgrade feel obvious. Every tier is framed to deliver more visible power,
          better presence, and stronger community momentum than the price suggests.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-amber-400/25 bg-amber-950/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Estimated launch revenue</p>
            <p className="mt-2 text-3xl font-semibold text-white">$28.7k</p>
            <p className="mt-1 text-xs text-slate-400">Based on Core+, boost, and creator campaign adoption.</p>
          </div>
          <div className="rounded-[24px] border border-amber-500/25 bg-amber-950/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Premium adoption</p>
            <p className="mt-2 text-3xl font-semibold text-white">18%</p>
            <p className="mt-1 text-xs text-slate-400">Expected upgrade rate for engaged communities.</p>
          </div>
          <div className="rounded-[24px] border border-amber-500/25 bg-amber-950/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Average ARPU</p>
            <p className="mt-2 text-3xl font-semibold text-white">$12.99</p>
            <p className="mt-1 text-xs text-slate-400">Revenue per active paid user per month.</p>
          </div>
        </div>
        {billingStatusMessage ? (
          <div className="nexus-display-panel mt-4 rounded-[20px] border border-amber-500/40 bg-amber-950/25 p-3 text-xs text-amber-100">
            <p>{billingStatusMessage}</p>
            {billingStatusDetail ? <p className="mt-2 text-[11px] text-amber-200/90">{billingStatusDetail}</p> : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="nexus-display-panel rounded-[24px] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Founder Window</p>
            <p className="mt-2 text-lg font-semibold text-slate-50">Early pricing is intentionally aggressive while NexusForge scales up.</p>
            <p className="mt-1 text-sm text-slate-300">
              Lock in a lower annual rate now and keep it as long as the subscription stays active.
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-100">
              Founder pricing countdown: {founderCountdown}
            </div>
          </div>
          <div className="nexus-display-panel rounded-[24px] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Why users upgrade</p>
            <p className="mt-2 text-sm text-slate-300">
              Better identity, faster access, stronger visibility, and operational tools that free communities from basic-chat limitations.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-3 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Billing Interval</span>
            <Button
              onClick={() => setInterval("MONTHLY")}
              variant="ghost"
              className={`h-8 rounded-md px-3 text-xs ${interval === "MONTHLY" ? "border-amber-500/55 text-amber-100" : "text-slate-300"}`}
            >
              Monthly
            </Button>
            <Button
              onClick={() => setInterval("YEARLY")}
              variant="ghost"
              className={`h-8 rounded-md px-3 text-xs ${interval === "YEARLY" ? "border-amber-500/55 text-amber-100" : "text-slate-300"}`}
            >
              Yearly
            </Button>
          </div>
          <div className="rounded-full border border-amber-500/35 bg-amber-950/25 px-3 py-1 text-amber-100">
            {interval === "YEARLY" ? "Best value unlocked" : "Switch yearly to save more"}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <article className="nexus-display-panel rounded-[24px] p-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Boost Pack Emblem</p>
            <p className="mt-1 text-xs text-slate-400">Primary image used for Forge Boost Pack purchase flows and callouts.</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/65">
              <Image
                src="/brand/boost-pack-icon.png"
                alt="NexusForge boost pack icon"
                width={1200}
                height={1200}
                className="h-auto w-full object-cover"
              />
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {tierCards.map((tier, index) => (
            <motion.article
              key={tier.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
              className={`nexus-interactive-card rounded-2xl border bg-slate-950/55 p-4 ${tier.spotlight ? "border-amber-400/70 shadow-[0_18px_50px_rgba(251,191,36,0.16)]" : "border-slate-700/70"}`}
            >
              <div className="mb-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/65">
                <Image
                  src={tierLogoById[tier.id as "CORE" | "PLUS" | "ELITE" | "INFINITE"].src}
                  alt={`${tier.name} tier artwork`}
                  width={1200}
                  height={800}
                  className="h-auto w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${tier.tone}`}>{tier.name}</div>
                <div className={`text-[11px] font-semibold ${tier.accent}`}>{tier.badge}</div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{tier.description}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-3xl font-semibold text-slate-50">{interval === "YEARLY" ? tier.yearly : tier.monthly}</p>
                <p className="pb-1 text-xs text-slate-400">{interval === "YEARLY" ? "per year" : "per month"}</p>
              </div>
              <p className="mt-1 text-xs text-amber-200">{tier.yearlySavings}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-200">
                {tier.perks.map((perk) => (
                  <li key={perk}>• {perk}</li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout({ featureCode: "CORE_PLUS", tier: tier.id as "CORE" | "PLUS" | "ELITE" | "INFINITE" })}
                disabled={checkoutMutation.isPending || !billingReady}
                className={`mt-4 h-10 w-full rounded-lg px-3 text-xs ${tier.spotlight ? "border-amber-300 bg-[linear-gradient(180deg,rgba(253,230,138,1),rgba(252,211,77,0.96)_45%,rgba(245,158,11,0.96))] text-slate-950 shadow-[0_16px_30px_rgba(245,158,11,0.26)]" : ""}`}
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
        className="nexus-display-panel rounded-[28px] p-5 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Tier Comparison</p>
            <h3 className="mt-1 font-[family-name:var(--font-orbitron)] text-xl text-slate-50">See what actually gets better as users move up.</h3>
          </div>
          <div className="rounded-full border border-amber-500/35 bg-amber-950/20 px-3 py-1 text-xs text-amber-100">
            Plus Command is the strongest value-to-price tier
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-700/75 text-slate-300">
                <th className="py-2 pr-3 font-semibold">Feature</th>
                <th className="py-2 pr-3 font-semibold">Starter Core</th>
                <th className="py-2 pr-3 font-semibold text-amber-200">Plus Command</th>
                <th className="py-2 pr-3 font-semibold">Elite Creator</th>
                <th className="py-2 font-semibold">Infinite League</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-slate-800/70 text-slate-200">
                  <td className="py-2 pr-3 font-medium text-slate-100">{row.label}</td>
                  {row.values.map((value, index) => (
                    <td key={`${row.label}-${index}`} className={`py-2 pr-3 ${index === 1 ? "text-amber-100" : "text-slate-300"}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="nexus-display-panel rounded-[28px] p-5 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Paid Feature Catalog</p>
          <p className="text-xs text-slate-400">Payments designed to feel clean, fast, and low-risk.</p>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          {trustSignals.map((signal) => (
            <div key={signal} className="glass-cut rounded-xl px-3 py-2 text-xs text-slate-200">
              {signal}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-700/75 text-slate-300">
                <th className="py-2 pr-3 font-semibold">Paid Item</th>
                <th className="py-2 pr-3 font-semibold">Price</th>
                <th className="py-2 font-semibold">Required For</th>
              </tr>
            </thead>
            <tbody>
              {paidCatalog.map((row) => (
                <tr key={row.item} className="border-b border-slate-800/70 align-top text-slate-200">
                  <td className="py-2 pr-3 font-medium text-slate-100">{row.item}</td>
                  <td className="py-2 pr-3 text-amber-100">{row.price}</td>
                  <td className="py-2 text-slate-300">{row.requiredFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="nexus-display-panel rounded-[24px] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Quick Buy Paths</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => handleCheckout({ featureCode: "FORGE_BOOST_PACK", quantity: 1 })}
                disabled={checkoutMutation.isPending || !billingReady}
                variant="ghost"
                className="h-9 rounded-lg border-amber-500/40 px-3 text-xs text-amber-100"
              >
                Buy Boost Pack
              </Button>
              <Button
                onClick={() => handleCheckout({ featureCode: "CREATOR_CAMPAIGN_SLOT", quantity: 1 })}
                disabled={checkoutMutation.isPending || !billingReady}
                variant="ghost"
                className="h-9 rounded-lg border-fuchsia-500/40 px-3 text-xs text-fuchsia-100"
              >
                Buy Campaign Slot
              </Button>
              <Button
                onClick={() => handleCheckout({ featureCode: "ADVANCED_MODERATION_AI", quantity: 1 })}
                disabled={checkoutMutation.isPending || !billingReady}
                variant="ghost"
                className="h-9 rounded-lg border-rose-500/40 px-3 text-xs text-rose-100"
              >
                Buy Moderation AI
              </Button>
              <Link
                href="/core-plus"
                className="nexus-interactive-btn inline-flex h-9 items-center rounded-lg border border-amber-500/40 bg-[linear-gradient(155deg,rgba(8,47,73,0.24),rgba(15,23,42,0.9))] px-3 text-xs font-semibold text-amber-100 hover:border-amber-300"
              >
                Manage Billing
              </Link>
            </div>
            <div className="mt-4 grid gap-3 rounded-[24px] border border-amber-500/25 bg-amber-950/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Growth Revenue Estimator</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-[11px] text-slate-300">
                  Members
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    step={50}
                    value={projectedMembers}
                    onChange={(event) => setProjectedMembers(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="mt-1 block text-slate-400">{projectedMembers.toLocaleString()}</span>
                </label>
                <label className="text-[11px] text-slate-300">
                  Paid adoption
                  <input
                    type="range"
                    min={2}
                    max={40}
                    step={1}
                    value={projectedAdoptionPct}
                    onChange={(event) => setProjectedAdoptionPct(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="mt-1 block text-slate-400">{projectedAdoptionPct}%</span>
                </label>
                <label className="text-[11px] text-slate-300">
                  Avg paid ARPU
                  <input
                    type="range"
                    min={5}
                    max={45}
                    step={1}
                    value={estimatedArpu}
                    onChange={(event) => setEstimatedArpu(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="mt-1 block text-slate-400">${estimatedArpu.toFixed(2)}</span>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Paid Members</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{projectedRevenue.activePaidMembers.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Projected MRR</p>
                  <p className="mt-1 text-sm font-semibold text-amber-200">${projectedRevenue.monthly.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Projected ARR</p>
                  <p className="mt-1 text-sm font-semibold text-amber-200">${projectedRevenue.annual.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="nexus-display-panel rounded-[24px] p-4 text-sm text-slate-200">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Checkout Confidence</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>• You are redirected instantly to a live checkout session.</li>
              <li>• Subscription changes can be managed later from the billing portal.</li>
              <li>• Successful payments activate subscriptions or entitlements automatically.</li>
              <li>• Canceling checkout leaves your current access unchanged.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {upgradeOutcomes.map((outcome) => (
            <div key={outcome.title} className="glass-cut rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-100">{outcome.title}</p>
              <p className="mt-1 text-xs text-slate-400">{outcome.detail}</p>
            </div>
          ))}
        </div>
        {checkoutMutation.error ? <p className="mt-2 text-xs text-red-300">Checkout failed: {checkoutErrorMessage}</p> : null}
      </motion.article>
    </section>
  );
}
