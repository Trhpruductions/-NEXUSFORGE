"use client";

import { useState } from "react";
import Link from "next/link";
import { ExperienceShell } from "@/components/layout/experience-shell";

const reportTemplate = `# NexusForge Beta Report

- Date/Time:
- Tester Name:
- Route URL:
- Device + Browser:
- Severity: Critical | High | Medium | Low

## Summary

## Steps To Reproduce
1.
2.
3.

## Expected Behavior

## Actual Behavior

## Notes
`;

export default function BetaFeedbackPage() {
  const [copied, setCopied] = useState(false);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(reportTemplate);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ExperienceShell
      eyebrow="Beta Ops"
      title="Feedback Intake"
      subtitle="Capture consistent bug reports so triage can move fast and fixes can be verified."
      metrics={[
        { label: "Template", value: "Standardized", tone: "cyan" },
        { label: "Triage Speed", value: "Faster", tone: "emerald" },
        { label: "Coverage", value: "UX + Stability", tone: "amber" },
      ]}
      actions={[
        { label: "Back to Beta Hub", href: "/beta", tone: "ghost" },
        { label: "Open Checklist", href: "/beta/checklist", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section className="nexus-display-panel rounded-[28px] p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Report Template</p>
        <textarea
          aria-label="Beta feedback report template"
          title="Beta feedback report template"
          readOnly
          value={reportTemplate}
          className="mt-4 min-h-80 w-full rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 font-mono text-xs text-slate-200 outline-none"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyTemplate()}
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-cyan-500/40 bg-cyan-950/25 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
          >
            {copied ? "Copied" : "Copy Report Template"}
          </button>
          <Link
            href="/beta/checklist"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-slate-700/80 bg-slate-900/75 px-4 text-sm font-semibold text-slate-100 hover:border-cyan-500/45"
          >
            Return to Checklist
          </Link>
        </div>
      </section>
    </ExperienceShell>
  );
}
