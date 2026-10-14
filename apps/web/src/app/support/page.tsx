import type { Metadata } from "next";
import Link from "next/link";
import { Bug, LifeBuoy, Mail, ShieldAlert, Ticket } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { HelpCenter } from "@/components/support/help-center";
import { StatusCard } from "@/components/support/status-card";
import { ReportProblem } from "@/components/home/report-problem";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with your Nexus Forge Gaming account, servers, voice, Core+ and the desktop app. Search the help center, check service status, open a ticket or report a problem.",
};

const contact = [
  { icon: Ticket, title: "Open a support ticket", text: "For anything about your account. A real person replies in the app and by email. Sign in first.", href: "/app/support?new=1", cta: "Open a ticket" },
  { icon: Bug, title: "Report a problem", text: "Something broken, can't sign in, or a payment issue. No account needed.", href: "#report", cta: "Report it" },
  { icon: ShieldAlert, title: "Report abuse", text: "Report a message or a person from inside the app; moderators and staff see it. Urgent safety issue? Use the form below and pick Safety.", href: "/app", cta: "Open the app" },
  { icon: Mail, title: "Already have a ticket?", text: "Replies show up in the app under Support, and you get an email when staff answer.", href: "/app/support", cta: "My tickets" },
];

export default function SupportPage() {
  return (
    <ExperienceShell
      eyebrow="Help center"
      title="How can we help?"
      subtitle="Search the help articles, check whether everything's running, or get in touch. The people who answer are the people who build the app."
      actions={[
        { label: "Open a ticket", href: "/app/support?new=1", tone: "primary" },
        { label: "Report a problem", href: "#report", tone: "ghost" },
      ]}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <HelpCenter />

          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white"><LifeBuoy className="h-4 w-4 text-amber-300" /> Still stuck? Talk to us</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {contact.map((item) => (
                <div key={item.title} className="flex flex-col rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><item.icon className="h-5 w-5" /></span>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-slate-400">{item.text}</p>
                  {item.href.startsWith("#") ? (
                    <a href={item.href} className="mt-3 inline-flex w-fit items-center rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">{item.cta}</a>
                  ) : (
                    <Link href={item.href} className="mt-3 inline-flex w-fit items-center rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">{item.cta}</Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section id="report" aria-labelledby="report-heading" className="scroll-mt-24">
            <h2 id="report-heading" className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white"><Bug className="h-4 w-4 text-amber-300" /> Report a problem</h2>
            <p className="mb-3 mt-1 text-sm text-slate-400">Works whether or not you&apos;re signed in. Include what you were doing and what happened instead; never include passwords or codes.</p>
            <ReportProblem />
          </section>
        </div>

        <aside className="space-y-4">
          <StatusCard />
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Before you write in</h2>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>• Include your <strong className="text-slate-200">username</strong> and, for account issues, the email on the account.</li>
              <li>• Say what you expected and what happened instead.</li>
              <li>• Staff will <strong className="text-slate-200">never</strong> ask for your password or a sign-in code.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Policies</h2>
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
              <Link href="/legal/terms" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:border-amber-400/50">Terms</Link>
              <Link href="/legal/privacy" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:border-amber-400/50">Privacy</Link>
              <Link href="/legal" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:border-amber-400/50">All policies</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Who we are</h2>
            <p className="text-xs text-slate-400">Nexus Forge Gaming is built and run by <Link href="/about" className="font-semibold text-slate-200 hover:text-white">TRH Development</Link>, an independent studio. Support is handled by the team itself.</p>
          </div>
        </aside>
      </div>
    </ExperienceShell>
  );
}
