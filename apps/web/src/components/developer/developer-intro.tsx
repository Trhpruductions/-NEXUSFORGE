import Link from "next/link";
import { ArrowRight, Bot, KeyRound, Webhook, Workflow } from "lucide-react";

const offers = [
  { icon: Bot, title: "Bots with /commands", text: "Register a bot, publish it to the public catalog, and let server owners add it in one click. Commands reply with templates ({user}, {forge}, {args}) and can be limited to moderators.", href: "/developer/applications" },
  { icon: KeyRound, title: "Sign in with Nexus Forge", text: "Standard OAuth 2.0 authorization-code flow. People see exactly which app is asking and what it gets before they press Allow. Client secrets can be rotated any time.", href: "/developer/oauth" },
  { icon: Webhook, title: "Developer webhooks", text: "Get an HTTPS call when your bot is created, installed into a server, or one of its commands runs. Each delivery is signed with your webhook secret.", href: "/developer/webhooks" },
  { icon: Workflow, title: "Channel webhooks", text: "Server managers can create a webhook URL for any channel, so your tooling can post messages straight into it.", href: "/features#bots" },
];

/** What developers can build, shown to everyone (the portal below needs a sign-in). */
export function DeveloperIntro() {
  return (
    <div className="mb-5 space-y-3">
      <section className="grid gap-3 sm:grid-cols-2">
        {offers.map((offer) => (
          <Link key={offer.title} href={offer.href} className="group rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4 transition hover:border-amber-400/40">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><offer.icon className="h-5 w-5" /></span>
            <h2 className="mt-3 text-base font-semibold text-white group-hover:text-amber-100">{offer.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{offer.text}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Built by TRH Development" className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-[#0d1119] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">Built by</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-white">
            TRH Development
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[11px] font-normal text-slate-300">trhdevelopment</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">The studio behind Nexus Forge Gaming and this developer platform. Questions about building on it? Send them to support.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/about" className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">About the studio</Link>
          <Link href="/support" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 hover:border-amber-300">Ask a question <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>
    </div>
  );
}
