import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const dynamic = "force-static";

export default function DesktopOnlyPage() {
  const desktopOnlyEnabled = process.env.NEXUSFORGE_DESKTOP_ONLY !== "false";

  return (
    <ExperienceShell
      eyebrow="Launch Mode"
      title="NexusForge is desktop-only right now"
      subtitle="Mobile and browser launch are temporarily locked while the desktop experience is hardened."
      metrics={[
        { label: "Desktop Access", value: desktopOnlyEnabled ? "Enabled" : "Disabled", tone: desktopOnlyEnabled ? "emerald" : "amber" },
        { label: "Web Access", value: desktopOnlyEnabled ? "Locked" : "Available", tone: "cyan" },
      ]}
      maxWidthClassName="max-w-4xl"
    >

        <section className="nexus-panel rounded-2xl p-5 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Current Status</p>
          <p className="mt-2">
            Desktop access is {desktopOnlyEnabled ? "ENABLED" : "DISABLED"}. When you are ready to launch web/mobile,
            set <span className="font-semibold text-cyan-100">NEXUSFORGE_DESKTOP_ONLY=false</span> and redeploy the web app.
          </p>
          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-xs text-slate-400">
            Desktop users should open NexusForge through the Electron app launcher.
          </div>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 font-semibold text-slate-100"
            >
              Refresh Status
            </Link>
          </div>
        </section>
    </ExperienceShell>
  );
}
