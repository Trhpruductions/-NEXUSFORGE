import { CorePlusExperience } from "@/components/brand/core-plus-experience";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default async function CorePlusPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <ExperienceShell
      eyebrow="Core+"
      title="Premium Membership Command Surface"
      subtitle="Upgrade tiers, control billing, and view premium operational outcomes in one polished flow."
      metrics={[
        { label: "Membership", value: "Tiered", tone: "amber" },
        { label: "Boost System", value: "Progressive", tone: "emerald" },
        { label: "Portal Access", value: "Integrated", tone: "cyan" },
      ]}
      actions={[
        { label: "Open Pricing", href: "/pricing", tone: "ghost" },
        { label: "Back to App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-[1300px]"
    >
      <CorePlusExperience checkoutState={resolved.checkout} />
    </ExperienceShell>
  );
}
