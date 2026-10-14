import Link from "next/link";
import { Bot, KeyRound, Webhook, Workflow } from "lucide-react";

const offers = [
  { icon: Bot, title: "Bots with /commands", text: "Register a bot, publish it to the public catalog, and let server owners add it in one click. Commands reply with templates ({user}, {forge}, {args}) and can be limited to moderators.", href: "/developer/applications" },
  { icon: KeyRound, title: "Sign in with Nexus Forge", text: "Standard OAuth 2.0 authorization-code flow. People see exactly which app is asking and what it gets before they press Allow. Client secrets can be rotated any time.", href: "/developer/oauth" },
  { icon: Webhook, title: "Developer webhooks", text: "Get an HTTPS call when your bot is created, installed into a server, or one of its commands runs. Each delivery is signed with your webhook secret.", href: "/developer/webhooks" },
  { icon: Workflow, title: "Channel webhooks", text: "Server managers can create a webhook URL for any channel, so your tooling can post messages straight into it.", href: "/features#bots" },
];

/** What developers can build, shown to everyone (the portal below needs a sign-in). */
export function DeveloperIntro() {
  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2">
      {offers.map((offer) => (
        <Link key={offer.title} href={offer.href} className="group rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4 transition hover:border-amber-400/40">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><offer.icon className="h-5 w-5" /></span>
          <h2 className="mt-3 text-base font-semibold text-white group-hover:text-amber-100">{offer.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{offer.text}</p>
        </Link>
      ))}
    </section>
  );
}
