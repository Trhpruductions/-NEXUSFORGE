import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";

export const dynamic = "force-static";

export default function DesktopOnlyPage() {
  const desktopOnlyEnabled = String(process.env.NEXUSFORGE_DESKTOP_ONLY || "").toLowerCase() === "true";

  return (
    <ExperienceShell
      eyebrow="Launch Mode"
      title="Vexora Gaming is desktop-only right now"
      subtitle="Web access is temporarily locked while the desktop experience is hardened."
      metrics={[
        { label: "Desktop Access", value: desktopOnlyEnabled ? "Enabled" : "Disabled", tone: "amber" },
        { label: "Web Access", value: desktopOnlyEnabled ? "Locked" : "Available", tone: "amber" },
      ]}
      actions={[
        { label: "Sign in", href: "/login?redirect=/desktop-only", tone: "ghost" },
        { label: "Create account", href: "/register?redirect=/desktop-only", tone: "primary" },
      ]}
      maxWidthClassName="max-w-4xl"
    >

        <section className="nexus-display-panel rounded-[28px] border border-white/10 bg-[#11151e] p-5 text-sm text-slate-400 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Current Status</p>
          <p className="mt-2">
            Desktop access is {desktopOnlyEnabled ? "ENABLED" : "DISABLED"}. When you are ready to reopen web access,
            set <span className="font-semibold text-amber-200">NEXUSFORGE_DESKTOP_ONLY=false</span> and redeploy the web app.
          </p>
          <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0d1119] p-3 text-xs text-slate-500">
            Desktop users should open Vexora Gaming through the Electron app launcher.
          </div>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-white/10 bg-amber-400 px-4 font-semibold text-slate-950 hover:bg-[#0d1119]"
            >
              Refresh Status
            </Link>
          </div>
        </section>
        <section className="mt-6">
          <GuestAuthCallout
            title="Sign in to access your Vexora Gaming desktop preview account."
            description="Register or login to manage your desktop-only beta access, invite flow, and support settings."
            loginHref="/login?redirect=/desktop-only"
            registerHref="/register?redirect=/desktop-only"
          />
        </section>
    </ExperienceShell>
  );
}

