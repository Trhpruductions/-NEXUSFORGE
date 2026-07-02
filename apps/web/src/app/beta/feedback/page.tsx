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
        { label: "Template", value: "Standardized", tone: "amber" },
        { label: "Triage Speed", value: "Faster", tone: "amber" },
        { label: "Coverage", value: "UX + Stability", tone: "amber" },
      ]}
      actions={[
        { label: "Back to Beta Hub", href: "/beta", tone: "ghost" },
        { label: "Open Checklist", href: "/beta/checklist", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section className="nexus-display-panel rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-600">Report Template</p>
        <textarea
          aria-label="Beta feedback report template"
          title="Beta feedback report template"
          readOnly
          value={reportTemplate}
          className="mt-4 min-h-80 w-full rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 font-mono text-xs text-slate-700 outline-none"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyTemplate()}
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-full border border-slate-900/10 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy Report Template"}
          </button>
          <Link
            href="/beta/checklist"
            className="nexus-interactive-btn inline-flex h-10 items-center rounded-full border border-slate-900/10 bg-slate-50 px-4 text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Return to Checklist
          </Link>
        </div>
      </section>
    </ExperienceShell>
  );
}

