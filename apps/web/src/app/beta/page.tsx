import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function BetaPage() {
  return (
    <ExperienceShell
      eyebrow="NexusForge Beta"
      title="Desktop-First Beta Access"
      subtitle="Welcome testers. Use this page as the starting point for account creation, login, and invite acceptance."
      metrics={[
        { label: "Build Channel", value: "Beta", tone: "cyan" },
        { label: "Platform", value: "Desktop-first web", tone: "emerald" },
        { label: "Status", value: "Open", tone: "amber" },
      ]}
      actions={[
        { label: "Open App", href: "/app", tone: "primary" },
        { label: "Checklist", href: "/beta/checklist", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section className="nexus-display-panel rounded-[28px] p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Tester Onboarding</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/register?redirect=%2Fapp"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-cyan-500/45 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
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
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 text-sm font-semibold text-slate-100 hover:border-cyan-500/45"
          >
            Explore Community
          </Link>
          <Link
            href="/beta/feedback"
            className="nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/45 bg-emerald-950/25 px-4 text-sm font-semibold text-emerald-100 hover:border-emerald-300"
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
            className="nexus-interactive-btn rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100 hover:border-cyan-300"
          >
            Open Test Checklist
          </Link>
          <Link
            href="/beta/feedback"
            className="nexus-interactive-btn rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100 hover:border-emerald-300"
          >
            Open Feedback Intake
          </Link>
        </div>
      </section>
    </ExperienceShell>
  );
}
