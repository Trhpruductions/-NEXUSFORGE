import { Suspense } from "react";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function SettingsPage() {
  return (
    <ExperienceShell
      eyebrow="Account Control"
      title="Profile and Presence Settings"
      subtitle="Tune your identity, presence, and billing-linked perks with a clear app-grade control surface."
      metrics={[
        { label: "Identity", value: "Customizable", tone: "amber" },
        { label: "Presence", value: "Real-time", tone: "amber" },
        { label: "Billing Sync", value: "Integrated", tone: "amber" },
      ]}
      actions={[
        { label: "Back to App", href: "/app", tone: "ghost" },
        { label: "View Pricing", href: "/pricing", tone: "primary" },
      ]}
      maxWidthClassName="max-w-6xl"
    >
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="nexus-panel-glass rounded-none border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <Suspense fallback={<div className="nexus-display-panel rounded-none p-5 text-sm text-slate-400">Loading settings workspace...</div>}>
            <ProfileSettingsForm />
          </Suspense>
        </div>

        <aside className="nexus-panel-glass rounded-none border border-slate-700/70 bg-slate-950/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Settings Brief</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Everything connected.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Your profile, presence, and billing are now organized in one premium control surface.
            Update identity, enable push, and manage billing straps without opening a separate console.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="nexus-metric-card rounded-none p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Profile Reach</p>
              <p className="mt-2 text-2xl font-semibold text-white">Public identity</p>
            </div>
            <div className="nexus-metric-card rounded-none p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Presence</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">Always visible</p>
            </div>
            <div className="nexus-metric-card rounded-none p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Billing</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">Instant upgrade ready</p>
            </div>
          </div>

          <div className="mt-6 rounded-none border border-amber-500/20 bg-slate-900/60 p-4 text-sm text-slate-300">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Pro tip</p>
            <p className="mt-2">
              Use custom avatar and banner art to make your profile stand out in raids and social feeds. Core+ unlocks the highest visibility for Forge leaders.
            </p>
          </div>
        </aside>
      </div>
    </ExperienceShell>
  );
}
