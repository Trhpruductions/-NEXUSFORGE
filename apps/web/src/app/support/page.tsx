import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessageSquare, ShieldCheck, Users, Wrench } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with your Vexora Gaming account, forges and the desktop app.",
};

const topics = [
  { icon: ShieldCheck, title: "Account & security", body: "Verify your email and phone, turn on two-factor sign-in, or recover a locked account.", href: "/app/settings?verify=1", cta: "Open account protection" },
  { icon: Users, title: "Forges & invites", body: "Create a forge, manage roles and channels, or fix an invite link that stopped working.", href: "/app/server", cta: "Go to Community" },
  { icon: MessageSquare, title: "Chat & voice", body: "Messages not sending, voice rooms not connecting, or notifications you did not expect.", href: "/app/chat", cta: "Open chat" },
  { icon: Wrench, title: "Desktop app", body: "Install or update Vexora Gaming for Windows, or run the recovery mode from the launcher.", href: "/app/downloads", cta: "Downloads" },
];

export default function SupportPage() {
  return (
    <ExperienceShell
      eyebrow="Need help?"
      title="Vexora Gaming support"
      subtitle="Pick a topic, or email the team and a real person will get back to you."
      actions={[{ label: "Email support", href: "mailto:support@vexoragaming.com", tone: "primary" }]}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          {topics.map((topic) => (
            <div key={topic.title} className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><topic.icon className="h-5 w-5" /></span>
              <h2 className="text-base font-semibold text-white">{topic.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{topic.body}</p>
              <Link href={topic.href} className="mt-3 inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">{topic.cta}</Link>
            </div>
          ))}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
            <h2 className="nf-heading mb-2 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white"><LifeBuoy className="h-4 w-4 text-amber-300" /> Contact</h2>
            <a href="mailto:support@vexoragaming.com" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white"><Mail className="h-4 w-4" /> support@vexoragaming.com</a>
            <p className="mt-2 text-xs text-slate-500">Include your username and, for account issues, the email on the account. Never send passwords or codes.</p>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Policies</h2>
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
              <Link href="/terms" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:border-amber-400/50">Terms</Link>
              <Link href="/privacy" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:border-amber-400/50">Privacy</Link>
            </div>
          </div>
        </aside>
      </div>
    </ExperienceShell>
  );
}
