import { Suspense } from "react";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { DesktopUpdateBanner } from "@/components/desktop/desktop-update-banner";

export default function SettingsPage() {
  return (
    <>
      <DesktopUpdateBanner />
      <ExperienceShell
        eyebrow="Account Control"
        title="Profile and Presence Settings"
        subtitle="Tune your identity, presence, and billing-linked perks with a clear app-grade control surface."
        metrics={[
          { label: "Identity", value: "Customizable", tone: "cyan" },
          { label: "Presence", value: "Real-time", tone: "emerald" },
          { label: "Billing Sync", value: "Integrated", tone: "amber" },
        ]}
        actions={[
          { label: "Back to App", href: "/app", tone: "ghost" },
          { label: "View Pricing", href: "/pricing", tone: "primary" },
        ]}
        maxWidthClassName="max-w-6xl"
      >
        <Suspense fallback={<div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-400">Loading settings workspace...</div>}>
          <ProfileSettingsForm />
        </Suspense>
      </ExperienceShell>
    </>
  );
}
