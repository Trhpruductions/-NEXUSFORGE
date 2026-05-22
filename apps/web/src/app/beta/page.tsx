import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { DesktopLaunchInstructions } from "@/components/beta/desktop-launch-instructions";

export default async function BetaPage() {
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/u, "") || undefined;

  return (
    <ExperienceShell
      eyebrow="NexusForge Beta"
      title="Desktop-First Beta Access"
      subtitle="Welcome testers. Use this page as the starting point for account creation, login, and invite acceptance."
      metrics={[
        { label: "Build Channel", value: "Beta", tone: "amber" },
        { label: "Platform", value: "Desktop-first web", tone: "amber" },
        { label: "Status", value: "Open", tone: "amber" },
      ]}
      actions={[
        { label: "Open App", href: "/app", tone: "primary" },
        { label: "Sign in", href: "/login?redirect=/beta", tone: "ghost" },
        { label: "Create account", href: "/register?redirect=/beta", tone: "ghost" },
        { label: "Checklist", href: "/beta/checklist", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <GuestAuthCallout
        title="Welcome testers. Sign in or register to access the beta desktop command experience."
        description="Create a beta account or login to join the early NexusForge desktop preview and start testing launch workflows."
        loginHref="/login?redirect=/beta"
        registerHref="/register?redirect=/beta"
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="nexus-panel-glass rounded-[32px] border border-amber-400/10 bg-slate-950/80 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Beta overview</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Launch the desktop-first command center with a single step.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This page is your beta launchpad. Use the desktop launcher target below, then join test forges and send feedback directly from the command experience.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Desktop protocol", value: "Native app + web shell" },
              { label: "Invite workflow", value: "Fast join links" },
              { label: "Feedback path", value: "In-app reports" },
              { label: "Stability mode", value: "Observer friendly" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="nexus-panel-glass rounded-[32px] border border-slate-700/60 bg-slate-950/80 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.18)]">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Quick status</p>
          <div className="mt-5 grid gap-3">
            {[
              { label: "Target readiness", value: "Configured" },
              { label: "Desktop mode", value: "Preferred" },
              { label: "App link", value: envAppUrl ? "/app" : "Using browser origin" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl bg-slate-900/90 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <section className="nexus-display-panel rounded-[28px] p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Tester Onboarding</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/register?redirect=%2Fapp"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-amber-500/45 bg-amber-950/25 px-4 text-sm font-semibold text-amber-100 hover:border-amber-300"
          >
            Create Beta Account
          </Link>
          <Link
            href="/login?redirect=%2Fapp"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-amber-500/45 bg-amber-950/25 px-4 text-sm font-semibold text-amber-100 hover:border-amber-300"
          >
            Login
          </Link>
          <Link
            href="/search"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 text-sm font-semibold text-slate-100 hover:border-amber-500/45"
          >
            Explore Community
          </Link>
          <Link
            href="/beta/feedback"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-amber-500/45 bg-amber-950/25 px-4 text-sm font-semibold text-amber-100 hover:border-amber-300"
          >
            Report Feedback
          </Link>
        </div>

        <div className="nexus-display-panel mt-5 rounded-[24px] p-4 text-sm text-slate-300">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Recommended Beta Flow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Create an account.</li>
            <li>Sign in and open the command center.</li>
            <li>Use invite links from your coordinator to join test forges.</li>
            <li>Report UX or stability issues with route and timestamp.</li>
          </ol>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/beta/checklist"
            className="nexus-interactive-btn rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 hover:border-amber-300"
          >
            Open Test Checklist
          </Link>
          <Link
            href="/beta/feedback"
            className="nexus-interactive-btn rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 hover:border-amber-300"
          >
            Open Feedback Intake
          </Link>
        </div>

        <DesktopLaunchInstructions envAppUrl={envAppUrl} />
      </section>
    </ExperienceShell>
  );
}
