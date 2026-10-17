import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReportProblem } from "@/components/home/report-problem";
import { ServerMockup } from "@/components/site/app-mockups";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  ArrowRight,
  AtSign,
  Bot,
  Check,
  Download,
  KeyRound,
  Layers,
  MessagesSquare,
  Mic,
  Mic2,
  Monitor,
  Radio,
  ShieldCheck,
  Sparkles,
  Users2,
  Video,
  X,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Nexus Forge Gaming: servers, voice and chat for gamers" },
  description: "Servers, voice, video and chat for gamers, creators and esports teams, with more included free. Use it in your browser or on Windows. 18+.",
};

/** Only things that exist in the app today. */
const features = [
  { title: "Servers that set themselves up", text: "Start from a gaming, esports or creator template. Channels, roles and an invite link are ready before your first message.", icon: Layers },
  { title: "Voice, video and stages", text: "Voice channels with camera and screen share together, stage channels with speakers and raise-hand, and a soundboard.", icon: Mic2 },
  { title: "Chat with everything", text: "Threads, forum channels, polls, custom emoji, stickers, replies, pins, @mentions and search with filters like from: and has:.", icon: MessagesSquare },
  { title: "Moderation that holds the line", text: "AutoMod for words, links and invite spam, timeouts, slowmode, bans that stick, ranked roles and a full audit log.", icon: ShieldCheck },
  { title: "Bots and integrations", text: "Add bots with /commands in a click, channel webhooks, and \"Sign in with Nexus Forge\" for your own apps.", icon: Bot },
  { title: "Built-in safety", text: "Two-factor sign-in (authenticator app or email codes), blocking and reporting, and verified email.", icon: KeyRound },
];

/** What the Free plan includes that Discord puts behind Nitro (as of 2026). */
const freeVsPaid: Array<{ item: string; vexora: string; discord: string }> = [
  { item: "File uploads", vexora: "50 MB", discord: "10 MB (more needs Nitro)" },
  { item: "Message length", vexora: "4,000 characters", discord: "2,000 (4,000 needs Nitro)" },
  { item: "HD screen share & camera", vexora: "Included", discord: "Nitro" },
  { item: "Profile banner", vexora: "Included", discord: "Nitro" },
  { item: "Animated avatar", vexora: "Included", discord: "Nitro" },
  { item: "Servers you can join", vexora: "200", discord: "100 (200 needs Nitro)" },
];

const steps = [
  { title: "Create your free account", text: "Email and password. You can verify your email afterwards to secure your account. No card needed." },
  { title: "Start a server", text: "Pick a template or start empty. Share the invite link with your squad." },
  { title: "Play together", text: "Hop into voice, share your screen, run events and keep the chat clean with AutoMod." },
];

const faqs = [
  { q: "Is Nexus Forge free?", a: "Yes. The Free plan includes everything on this page with generous limits. Core+ plans (from $3.99 a month) raise upload size, server count and video quality for people who want more." },
  { q: "Who can join?", a: "Nexus Forge is for adults: you need to be 18 or older to create an account." },
  { q: "Do I need to download anything?", a: "No. It works in your browser. There's also a Windows desktop app if you prefer a separate window with automatic updates." },
  { q: "Is my account safe?", a: "Passwords are hashed, sign-ins can be protected with two-factor codes, and you get an email whenever your email or phone changes or a new device signs in." },
  { q: "Can I bring my Discord community?", a: "There is no Discord import yet. You can recreate your community here: create a server from a template (gaming, esports or creator), set up your channels and roles, then share your invite link." },
];

const goldButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-slate-950 shadow-[0_14px_40px_rgba(46,164,255,0.35)] transition hover:-translate-y-px";
const ghostButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-100 backdrop-blur transition hover:border-amber-400/40 hover:bg-white/10";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300";

function DiscordValue({ value }: { value: string }) {
  const needsNitro = value === "Nitro";
  return (
    <span className="inline-flex items-start gap-1.5">
      {needsNitro ? <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> : null}
      {needsNitro ? "Needs Nitro" : value}
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#040812] text-slate-100 selection:bg-amber-500/40 selection:text-white scroll-smooth">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(46,164,255,0.16),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(139,92,246,0.12),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(10,86,176,0.14),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]" />

      <SiteHeader />

      <main id="main-content" className="relative">
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="space-y-7">
            {/* The artwork has its own dark backdrop; "lighten" lets it melt into the page. */}
            <Image src="/brand/nexusforge-logo-600.png" alt="Nexus Forge Gaming" width={600} height={400} priority className="-mb-2 -ml-3 h-auto w-40 mix-blend-lighten sm:w-72" />
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(46,164,255,0.9)]" />
              Now in open beta
            </div>
            <h1 className="nf-heading text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your squad&apos;s home base,
              <span className="block bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_45%,#0b6fe0)] bg-clip-text text-transparent">forged for the grind.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Servers, voice, video and chat for gamers, creators and esports teams, with the things other apps charge for included free.
              Use it in your browser or on the Windows app.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/register" className={goldButton}>
                Create your free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/download" className={ghostButton}>
                <Download className="h-4 w-4" /> Download for Windows
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-1 text-sm text-slate-300 sm:grid-cols-4 sm:gap-2">
              {["50 MB uploads", "HD screen share", "No card needed", "Browser or desktop"].map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> {point}
                </li>
              ))}
            </ul>
          </div>
          <ServerMockup />
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className={eyebrow}>Everything a community needs</p>
              <h2 className="nf-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">One app for the whole squad.</h2>
              <p className="text-slate-400">Familiar where it should be, faster where it counts, and generous where others aren&apos;t.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="flex flex-col rounded-[22px] border border-white/8 bg-slate-950/60 p-6 transition hover:border-amber-400/35">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(46,164,255,0.35),rgba(176,130,15,0.35))] text-white">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.text}</p>
                </article>
              ))}
            </div>
            <ul className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300" aria-label="More features">
              {[
                [Video, "Camera + screen share together"],
                [Radio, "Go-live status on profiles"],
                [AtSign, "@everyone, @here and role mentions"],
                [Users2, "Friends, DMs and group DMs"],
                [Sparkles, "Avatar studio & wardrobe"],
                [Mic, "Push-to-talk & noise suppression"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Video;
                return (
                  <li key={label as string} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    <I className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Free vs paid elsewhere */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="space-y-3">
              <p className={eyebrow}>More for free</p>
              <h2 className="nf-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">The good stuff isn&apos;t behind a paywall.</h2>
              <p className="text-slate-400">
                The Free plan already includes what Discord charges Nitro for. Core+ is there if you want even bigger uploads, more servers and ultra-quality video.
              </p>
              <Link href="/pricing" className="inline-flex min-h-11 items-center gap-1.5 pt-2 text-sm font-semibold text-amber-200 hover:text-white">
                See all plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
              {/* Phones: one card per item. Wider screens: a comparison table. */}
              <ul className="divide-y divide-white/5 sm:hidden" aria-label="What the free plans include">
                {freeVsPaid.map((row) => (
                  <li key={row.item} className="space-y-2 px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-100">{row.item}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Nexus Forge</p>
                        <p className="mt-0.5 inline-flex items-start gap-1.5 font-semibold text-emerald-200"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {row.vexora}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Discord</p>
                        <p className="mt-0.5 text-slate-300"><DiscordValue value={row.discord} /></p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-left text-sm sm:table">
                <caption className="sr-only">What the free plans include</caption>
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th scope="col" className="px-4 py-3 font-semibold">Free plan</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-amber-200">Nexus Forge</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Discord</th>
                  </tr>
                </thead>
                <tbody>
                  {freeVsPaid.map((row) => (
                    <tr key={row.item} className="border-b border-white/5 last:border-0">
                      <th scope="row" className="px-4 py-3 font-medium text-slate-200">{row.item}</th>
                      <td className="px-4 py-3 font-semibold text-emerald-200">
                        <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 shrink-0" aria-hidden="true" /> {row.vexora}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <DiscordValue value={row.discord} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-white/5 px-4 py-3 text-xs leading-relaxed text-slate-400">
                Discord figures are its free-tier limits as we understand them; they change, so check discord.com. Discord is a trademark of Discord Inc.; Nexus Forge isn&apos;t affiliated with it.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <p className={eyebrow}>Up and running in a minute</p>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-[22px] border border-white/8 bg-slate-950/60 p-6">
                  <span className="nf-heading inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-sm font-bold text-amber-200">{index + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Desktop app */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid items-center gap-8 rounded-[28px] border border-violet-400/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(14,165,233,0.08)_55%,rgba(46,164,255,0.08))] p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200">Desktop app</p>
              <h2 className="nf-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Nexus Forge on your PC.</h2>
              <p className="max-w-xl text-slate-300">
                Its own window, a taskbar icon, and updates that install themselves. Same account, same servers as the browser.
              </p>
              <ul className="space-y-1.5 pt-1 text-sm text-slate-300">
                {["Windows 10 and 11 (64-bit)", "About 100 MB", "Free, with automatic updates"].map((point) => (
                  <li key={point} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> {point}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Monitor className="h-16 w-16 text-violet-200/80" aria-hidden="true" />
              <Link href="/download" className={goldButton}>
                <Download className="h-4 w-4" /> Download for Windows
              </Link>
              <Link href="/app" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline">or open it in your browser</Link>
            </div>
          </div>
        </section>

        {/* Report a problem */}
        <section id="report" className="mx-auto grid max-w-7xl scroll-mt-24 gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div className="space-y-3">
            <p className={eyebrow}>Report a problem</p>
            <h2 className="nf-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Something not working?</h2>
            <p className="text-slate-400">
              Tell us and the team will take a look. You don&apos;t need to be signed in. For a problem with a person or a message, you can also report it right inside the app.
            </p>
            <p className="text-sm text-slate-400">
              Need a conversation instead? <Link href="/support" className="font-semibold text-amber-200 underline-offset-4 hover:text-white hover:underline">Open a support ticket</Link>.
            </p>
          </div>
          <ReportProblem />
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
          <p className={eyebrow}>Questions</p>
          <h2 className="nf-heading mt-2 text-3xl font-bold tracking-tight text-white">Good to know</h2>
          <div className="mt-6 divide-y divide-white/5 rounded-[22px] border border-white/8 bg-slate-950/60">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                  {faq.q}
                  <span className="text-xl leading-none text-amber-300 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-amber-400/25 bg-[linear-gradient(135deg,rgba(46,164,255,0.18),rgba(30,139,255,0.22)_55%,rgba(10,86,176,0.18))] px-6 py-12 text-center shadow-[0_30px_90px_rgba(46,164,255,0.2)] sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_50%)]" />
            <h2 className="nf-heading relative text-3xl font-bold tracking-tight text-white sm:text-4xl">Bring your squad.</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-200">Free to start. Pick a template and be chatting in under a minute.</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950 shadow-lg transition hover:-translate-y-px">
                Create account <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
