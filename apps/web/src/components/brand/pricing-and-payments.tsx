"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createCheckoutSession, type PaidFeatureCode } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const tierCards = [
  {
    id: "CORE",
    name: "Starter Core",
    monthly: "$4.99",
    yearly: "$48",
    yearlySavings: "Save 20%",
    tone: "border-cyan-500/45 bg-cyan-950/30 text-cyan-100",
    accent: "text-cyan-200",
    badge: "Best entry",
    description: "For players who want premium identity without overcommitting.",
    cta: "Start Core",
    perks: ["Animated profile identity", "Faster text priority", "Member analytics starter pack", "Higher upload ceiling"],
  },
  {
    id: "PLUS",
    name: "Plus Command",
    monthly: "$11.99",
    yearly: "$108",
    yearlySavings: "2 months free",
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
    monthly: "$24.99",
    yearly: "$228",
    yearlySavings: "Save 24%",
    tone: "border-emerald-500/45 bg-emerald-950/30 text-emerald-100",
    accent: "text-emerald-200",
    badge: "Creator growth",
    description: "Built for communities monetizing events, drops, and sponsor attention.",
    cta: "Go Elite",
    perks: ["Everything in Plus", "Creator campaign slots", "Boost multiplier x2", "Featured promotion priority", "Advanced creator analytics"],
  },
  {
    id: "INFINITE",
    name: "Infinite League",
    monthly: "$44.99",
    yearly: "$420",
    yearlySavings: "Save 22%",
    tone: "border-fuchsia-500/45 bg-fuchsia-950/30 text-fuchsia-100",
    accent: "text-fuchsia-200",
    badge: "Full power",
    description: "Maximum velocity for premium brands, esports hubs, and top-tier community ops.",
    cta: "Unlock Infinite",
    perks: ["Everything in Elite", "White-glove support", "Boost multiplier x3", "Launch concierge help", "Top-priority feature access"],
  },
];

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

export function PricingAndPayments({ checkoutState }: { checkoutState?: string }) {
  const { accessToken, csrfToken } = useAuthStore();
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

  return (
    <section className="grid gap-4">
      {checkoutMutation.isPending && checkoutPreview ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/82 px-4 backdrop-blur-md"
        >
          <div className="w-full max-w-xl rounded-3xl border border-cyan-500/35 bg-slate-950/95 p-6 shadow-[0_24px_80px_rgba(8,145,178,0.2)]">
            <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-300">Launching secure checkout</p>
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
                <p className="mt-1 text-sm font-semibold text-emerald-200">Redirecting now</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-amber-300"
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">Do not close the page. NexusForge is securing your checkout session and handing off to billing.</p>
          </div>
        </motion.div>
      ) : null}
      {checkoutState === "success" ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-950/25 p-4 text-sm text-emerald-100">
          Payment completed. Your subscription or entitlement is being activated now.
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-950/20 p-4 text-sm text-amber-100">
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
        <div className="pointer-events-none absolute -left-14 top-[-70px] h-52 w-52 rounded-full bg-cyan-500/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-[-70px] h-56 w-56 rounded-full bg-amber-500/16 blur-3xl" />

        <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">Pricing + Payments</p>
        <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-4xl">
          Premium tiers that feel worth upgrading into.
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
          Start cheap, scale fast, and make the upgrade feel obvious. Every tier is framed to deliver more visible power,
          better presence, and stronger community momentum than the price suggests.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-950/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200">Founder Window</p>
            <p className="mt-2 text-lg font-semibold text-slate-50">Early pricing is intentionally aggressive while NexusForge scales up.</p>
            <p className="mt-1 text-sm text-slate-300">
              Lock in a lower annual rate now and keep it as long as the subscription stays active.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Why users upgrade</p>
            <p className="mt-2 text-sm text-slate-300">
              Better identity, faster access, stronger visibility, and operational tools that free communities from basic-chat limitations.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-3 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Billing Interval</span>
            <button
              onClick={() => setInterval("MONTHLY")}
              className={`rounded-md px-2 py-1 ${interval === "MONTHLY" ? "bg-cyan-900/60 text-cyan-100" : "text-slate-300"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("YEARLY")}
              className={`rounded-md px-2 py-1 ${interval === "YEARLY" ? "bg-amber-900/60 text-amber-100" : "text-slate-300"}`}
            >
              Yearly
            </button>
          </div>
          <div className="rounded-full border border-emerald-500/35 bg-emerald-950/25 px-3 py-1 text-emerald-100">
            {interval === "YEARLY" ? "Best value unlocked" : "Switch yearly to save more"}
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
              className={`rounded-2xl border bg-slate-950/55 p-4 ${tier.spotlight ? "border-amber-400/70 shadow-[0_18px_50px_rgba(251,191,36,0.16)]" : "border-slate-700/70"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${tier.tone}`}>{tier.name}</div>
                <div className={`text-[11px] font-semibold ${tier.accent}`}>{tier.badge}</div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{tier.description}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-3xl font-semibold text-slate-50">{interval === "YEARLY" ? tier.yearly : tier.monthly}</p>
                <p className="pb-1 text-xs text-slate-400">{interval === "YEARLY" ? "per year" : "per month"}</p>
              </div>
              <p className="mt-1 text-xs text-emerald-200">{tier.yearlySavings}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-200">
                {tier.perks.map((perk) => (
                  <li key={perk}>• {perk}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout({ featureCode: "CORE_PLUS", tier: tier.id as "CORE" | "PLUS" | "ELITE" | "INFINITE" })}
                disabled={checkoutMutation.isPending}
                className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-xs font-semibold ${tier.spotlight ? "border-amber-300 bg-amber-300 text-slate-950 hover:bg-amber-200" : "border-cyan-500/35 bg-cyan-950/25 text-cyan-100 hover:border-cyan-300"}`}
              >
                {checkoutMutation.isPending ? "Opening..." : tier.cta}
              </button>
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
        className="nexus-panel rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Tier Comparison</p>
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
        className="nexus-panel rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Paid Feature Catalog</p>
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
                  <td className="py-2 pr-3 text-cyan-100">{row.price}</td>
                  <td className="py-2 text-slate-300">{row.requiredFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Quick Buy Paths</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleCheckout({ featureCode: "FORGE_BOOST_PACK", quantity: 1 })}
                disabled={checkoutMutation.isPending}
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-300"
              >
                Buy Boost Pack
              </button>
              <button
                onClick={() => handleCheckout({ featureCode: "CREATOR_CAMPAIGN_SLOT", quantity: 1 })}
                disabled={checkoutMutation.isPending}
                className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-950/25 px-3 py-2 text-xs font-semibold text-fuchsia-100 hover:border-fuchsia-300"
              >
                Buy Campaign Slot
              </button>
              <button
                onClick={() => handleCheckout({ featureCode: "ADVANCED_MODERATION_AI", quantity: 1 })}
                disabled={checkoutMutation.isPending}
                className="rounded-lg border border-rose-500/40 bg-rose-950/25 px-3 py-2 text-xs font-semibold text-rose-100 hover:border-rose-300"
              >
                Buy Moderation AI
              </button>
              <Link
                href="/core-plus"
                className="rounded-lg border border-cyan-500/40 bg-cyan-950/25 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300"
              >
                Manage Billing
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-4 text-sm text-slate-200">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Checkout Confidence</p>
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
        {checkoutMutation.error ? <p className="mt-2 text-xs text-red-300">Checkout failed. Verify billing configuration and retry.</p> : null}
      </motion.article>
    </section>
  );
}
