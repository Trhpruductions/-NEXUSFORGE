import type { Metadata } from "next";
import Link from "next/link";
import { Bug, CheckSquare, CreditCard, Download, MessageSquare, Mic, ShieldCheck, Smartphone, Users } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata: Metadata = {
  title: "Beta program",
  description: "Help test Nexus Forge Gaming before launch: how to get in, what to try, how to report problems, and what's still switched off during the beta.",
};

const ways = [
  { icon: MessageSquare, title: "In your browser", text: "Nothing to install. Sign in at nfgcord.com/app on any computer.", href: "/register", cta: "Create a free account" },
  { icon: Download, title: "Windows desktop app", text: "The installer is on the download page. Windows may show a SmartScreen warning because the app isn't code-signed yet: choose “More info”, then “Run anyway”.", href: "/download", cta: "Download for Windows" },
  { icon: Smartphone, title: "Phone or Xbox", text: "Open the site, then use your browser's “Add to Home Screen” or “Install app”. Steps for iPhone, Android and Xbox are on the download page.", href: "/download#xbox", cta: "Install instructions" },
];

const checklist: { icon: typeof Users; title: string; items: string[] }[] = [
  {
    icon: ShieldCheck,
    title: "Your account",
    items: [
      "Create an account, then enter the 6-digit code from your email (check Spam if it's slow).",
      "Turn on two-factor sign-in under Settings → Account protection, sign out and back in.",
      "Change your avatar, banner and display name; check they show up in chat.",
    ],
  },
  {
    icon: Users,
    title: "Servers and chat",
    items: [
      "Create a server, add a text channel and a voice channel, and invite a friend with an invite link.",
      "Send messages with an image, a reply, a reaction, an @mention and a pinned message.",
      "Give a friend a role, then take it away. Try kick and ban on a test account.",
      "Send a direct message and start a group DM.",
    ],
  },
  {
    icon: Mic,
    title: "Voice and video",
    items: [
      "Join a voice channel with a friend: can you hear each other? Try mute, deafen and screen share.",
      "Start a video call from a DM. Try it on home Wi-Fi and on mobile data.",
      "Leave the voice channel while browsing other pages: the call should keep going until you hang up.",
    ],
  },
  {
    icon: CreditCard,
    title: "Core+ (test mode)",
    items: [
      "Open Pricing, pick a plan and go through checkout with the test card below. Nothing is charged.",
      "Afterwards, check that the bigger upload limit applies and that Settings → Billing shows the plan.",
      "Cancel from Billing and confirm the plan ends as described.",
    ],
  },
];

const limits = [
  { title: "Email only for codes", text: "Text-message codes are switched off during the beta. Sign-in and recovery codes arrive by email." },
  { title: "Payments are simulated", text: "Checkout runs in Stripe's test mode. Use card 4242 4242 4242 4242 with any future expiry date and any 3-digit code. No real money moves." },
  { title: "Uploads up to 95 MB for now", text: "Our hosting caps single uploads at 100 MB during the beta, whatever your plan says. Bigger uploads arrive with the storage upgrade before launch." },
  { title: "Short restarts", text: "Updates go out several times a week. A page may reload itself once when that happens; voice calls reconnect." },
  { title: "Installer warning", text: "The Windows installer isn't code-signed yet, so SmartScreen shows a warning. A signing certificate is on the list before launch." },
];

export default function BetaPage() {
  return (
    <ExperienceShell
      eyebrow="Beta program"
      title="Help us test Nexus Forge Gaming"
      subtitle="The whole app is open to try before launch. Use it like you'd use your normal gaming chat, and tell us whatever breaks, confuses you or feels slow."
      actions={[
        { label: "Create a free account", href: "/register", tone: "primary" },
        { label: "Report a problem", href: "/support#report", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section aria-labelledby="ways-heading">
        <h2 id="ways-heading" className="nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white">Three ways in</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {ways.map((way) => (
            <article key={way.title} className="flex flex-col rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><way.icon className="h-5 w-5" /></span>
              <h3 className="text-base font-semibold text-white">{way.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-400">{way.text}</p>
              <Link href={way.href} className="mt-3 inline-flex w-fit items-center rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">{way.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="checklist-heading" className="mt-8">
        <h2 id="checklist-heading" className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white"><CheckSquare className="h-4 w-4 text-amber-300" /> What to try</h2>
        <p className="mt-1 text-sm text-slate-400">You don't have to do all of it. Even one broken step reported well is a big help.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {checklist.map((group) => (
            <article key={group.title} className="rounded-2xl border border-white/5 bg-[#0d1119] p-4">
              <h3 className="inline-flex items-center gap-2 text-base font-semibold text-white"><group.icon className="h-4 w-4 text-amber-300" /> {group.title}</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-400">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="report-heading" className="mt-8 grid gap-4 rounded-2xl border border-amber-400/25 bg-[linear-gradient(135deg,rgba(46,164,255,0.14),rgba(30,139,255,0.18)_55%,rgba(10,86,176,0.14))] p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 id="report-heading" className="nf-heading inline-flex items-center gap-2 text-xl font-bold text-white"><Bug className="h-5 w-5" /> Found something?</h2>
          <p className="mt-1 text-sm text-slate-200">
            Use <Link href="/support#report" className="font-semibold text-white underline underline-offset-4">Report a problem</Link> (no sign-in needed) or open a ticket from Support inside the app. Say what you did, what you expected and what happened instead; a screenshot helps.
            Reports go straight to the people who build the app. Staff will never ask for your password or a sign-in code.
          </p>
        </div>
        <Link href="/support#report" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:-translate-y-px">
          Report a problem
        </Link>
      </section>

      <section aria-labelledby="limits-heading" className="mt-8">
        <h2 id="limits-heading" className="nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white">Good to know during the beta</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {limits.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/5 bg-[#0d1119] p-4">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Nexus Forge Gaming is for adults (18+). The <Link href="/legal/terms" className="text-slate-300 underline underline-offset-2">Terms</Link> and <Link href="/legal/privacy" className="text-slate-300 underline underline-offset-2">Privacy Policy</Link> apply during the beta too.
        </p>
      </section>
    </ExperienceShell>
  );
}
