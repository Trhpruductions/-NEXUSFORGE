import { CorePlusExperience } from "@/components/brand/core-plus-experience";

export default async function CorePlusPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <div className="relative min-h-screen overflow-x-clip px-4 py-8 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_6%,rgba(251,146,60,0.14),transparent_36%),radial-gradient(circle_at_84%_86%,rgba(34,211,238,0.1),transparent_38%),linear-gradient(170deg,#050b16_0%,#070f1c_52%,#0a1725_100%)]" />
      <CorePlusExperience checkoutState={resolved.checkout} />
    </div>
  );
}
