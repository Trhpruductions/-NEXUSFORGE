import { pageMetadata } from "@/lib/seo";
import { CorePlusExperience } from "@/components/brand/core-plus-experience";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata = pageMetadata({
  title: "Core+ membership",
  description: "Core+ raises your upload size, server count and video quality. Plans start at $3.99 a month, billed monthly or yearly.",
  path: "/core-plus",
});

export default async function CorePlusPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <ExperienceShell
      eyebrow="Core+"
      title="Core+ membership"
      subtitle="Bigger uploads, more servers and ultra-quality video. Pick a tier and billing cycle, then check out securely."
      metrics={[
        { label: "Plans", value: "From $3.99/mo", tone: "amber" },
        { label: "Billing", value: "Monthly or yearly", tone: "emerald" },
        { label: "Cancel", value: "Any time", tone: "cyan" },
      ]}
      actions={[
        { label: "Compare plans", href: "/pricing", tone: "ghost" },
        { label: "Back to app", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-[1300px]"
    >
      <CorePlusExperience checkoutState={resolved.checkout} checkoutSessionId={resolved.session_id} />
    </ExperienceShell>
  );
}
