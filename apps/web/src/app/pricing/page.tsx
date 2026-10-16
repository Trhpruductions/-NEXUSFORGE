import { pageMetadata } from "@/lib/seo";
import { PricingAndPayments } from "@/components/brand/pricing-and-payments";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Nexus Forge Gaming is free to use. Core+ plans from $3.99 a month add bigger uploads, more servers and ultra-quality video.",
  path: "/pricing",
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <ExperienceShell
      eyebrow="Core+"
      title="Plans and pricing"
      subtitle="Every plan includes the full app. Core+ adds bigger uploads, more servers and ultra-quality video."
      metrics={[
        { label: "Free plan", value: "$0, forever", tone: "emerald" },
        { label: "Core+ from", value: "$3.99/mo", tone: "amber" },
        { label: "Cancel", value: "Any time", tone: "cyan" },
      ]}
      actions={[
        { label: "Sign in", href: "/login?redirect=/pricing", tone: "ghost" },
        { label: "Create account", href: "/register?redirect=/pricing", tone: "primary" },
        { label: "Open App", href: "/app", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-[1300px]"
    >
      <div className="mx-auto w-full">
        <PricingAndPayments checkoutState={resolved.checkout} />
      </div>
    </ExperienceShell>
  );
}
