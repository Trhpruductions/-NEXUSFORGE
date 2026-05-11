import { PricingAndPayments } from "@/components/brand/pricing-and-payments";
import { PoweredByFooter } from "@/components/layout/powered-by-footer";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <ExperienceShell
      eyebrow="Monetization"
      title="Pricing, Payments, and Upgrade Flows"
      subtitle="Tiered subscriptions and add-ons built to feel premium, clear, and conversion-ready."
      metrics={[
        { label: "Checkout", value: "Secure Redirect", tone: "emerald" },
        { label: "Tier Ladder", value: "Core to Infinite", tone: "cyan" },
        { label: "Upgrade Momentum", value: "Optimized", tone: "amber" },
      ]}
      actions={[
        { label: "Open Core+", href: "/core-plus", tone: "ghost" },
        { label: "Open App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-[1300px]"
    >
      <main className="mx-auto w-full">
        <PricingAndPayments checkoutState={resolved.checkout} />
      </main>
      <PoweredByFooter />
    </ExperienceShell>
  );
}
