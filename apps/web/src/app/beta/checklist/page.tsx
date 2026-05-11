import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";

const checklistItems = [
  "Register new account and verify login redirect to /app",
  "Submit home search and confirm /search?q=... hydration",
  "Open notifications with /notifications?filter=activity",
  "Open settings with /settings?intent=create-forge",
  "Open invite route and validate join flow copy",
  "Check mobile and desktop layout rendering at /app",
  "Validate no dead links from /beta and /app quick actions",
  "Confirm error states render cleanly for empty lists",
];

export default function BetaChecklistPage() {
  return (
    <ExperienceShell
      eyebrow="Beta Ops"
      title="Beta Test Checklist"
      subtitle="Use this checklist to keep every tester validating the same critical journeys."
      metrics={[
        { label: "Critical Paths", value: `${checklistItems.length}`, tone: "cyan" },
        { label: "Priority", value: "High", tone: "amber" },
        { label: "Channel", value: "Beta", tone: "emerald" },
      ]}
      actions={[
        { label: "Back to Beta Hub", href: "/beta", tone: "ghost" },
        { label: "Open Feedback Form", href: "/beta/feedback", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section className="nexus-display-panel rounded-[28px] p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Execution List</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-200">
          {checklistItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/app"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
          >
            Start Testing in App
          </Link>
          <Link
            href="/beta/feedback"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-slate-700/80 bg-slate-900/75 px-4 text-sm font-semibold text-slate-100 hover:border-cyan-500/45"
          >
            Report Results
          </Link>
        </div>
      </section>
    </ExperienceShell>
  );
}
