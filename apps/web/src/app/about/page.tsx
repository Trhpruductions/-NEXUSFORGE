import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Bot, HeartHandshake, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata = pageMetadata({
  title: "About TRH Development",
  description: "Nexus Forge Gaming is built and run by TRH Development, an independent studio making tools for gaming communities.",
  path: "/about",
});

const principles = [
  { icon: Sparkles, title: "The good stuff is free", text: "Bigger uploads, HD video, banners and animated avatars are included for everyone. Paid plans raise limits; they don't lock away the basics." },
  { icon: ShieldCheck, title: "Safety first", text: "Nexus Forge is for adults (18+). Two-factor sign-in, verified contact details, blocking, reporting and real moderation tools come as standard." },
  { icon: Wrench, title: "Ship small, ship often", text: "Improvements go out continuously and are announced in the app's What's new, so you always know what changed." },
  { icon: HeartHandshake, title: "Listen", text: "Problem reports and support tickets go to the people who build the app. If something's broken, tell us and we'll fix it." },
];

const products = [
  { title: "Nexus Forge Gaming", text: "Servers, chat, voice and video for gaming communities, in the browser and as a Windows app.", href: "/features", cta: "See features" },
  { title: "Bots and integrations", text: "Bots with /commands, webhooks and “Sign in with Nexus Forge” for developers building on the platform.", href: "/developer", cta: "Developer portal" },
  { title: "Community tooling", text: "TRH Development also builds Discord bots and tools for gaming communities.", href: "https://trh.dev", cta: "trh.dev" },
];

export default function AboutPage() {
  return (
    <ExperienceShell
      eyebrow="About"
      title="Made by TRH Development"
      subtitle="Nexus Forge Gaming is built and run by TRH Development, an independent studio making tools for gaming communities."
      actions={[
        { label: "Support", href: "/support", tone: "ghost" },
        { label: "Create free account", href: "/register", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <section className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-6 md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">Why Nexus Forge</p>
        <h2 className="nf-heading mt-2 text-2xl font-bold text-white sm:text-3xl">A home base for squads, built by people who run them.</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
          <p>
            Gaming communities deserve a place that&apos;s fast, fair and theirs. Nexus Forge Gaming is that place: servers with real moderation tools, voice and video that keep up,
            and the features other apps charge for, included for free.
          </p>
          <p>
            TRH Development is a small, independent studio. We build Nexus Forge Gaming, run it, answer the support tickets and read every problem report. There&apos;s no
            separate company between you and the people writing the code.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {principles.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/5 bg-[#0d1119] p-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200"><item.icon className="h-5 w-5" /></span>
            <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">What we make</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {products.map((product) => (
            <article key={product.title} className="flex flex-col rounded-2xl border border-white/5 bg-[#0d1119] p-5">
              <h3 className="text-base font-semibold text-white">{product.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-400">{product.text}</p>
              {product.href.startsWith("http") ? (
                <a href={product.href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200 hover:text-white">
                  {product.cta} <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link href={product.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200 hover:text-white">
                  {product.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-amber-400/25 bg-[linear-gradient(135deg,rgba(46,164,255,0.14),rgba(30,139,255,0.18)_55%,rgba(10,86,176,0.14))] p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
        <div>
          <h2 className="nf-heading text-xl font-bold text-white sm:text-2xl">Get in touch</h2>
          <p className="mt-1 text-sm text-slate-200">
            Questions, partnership ideas or a bug to report? The <Link href="/support" className="font-semibold text-white underline underline-offset-4">support page</Link> reaches the team directly. Developers can start at the{" "}
            <Link href="/developer" className="font-semibold text-white underline underline-offset-4">developer portal</Link>.
          </p>
        </div>
        <Link href="/support" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:-translate-y-px">
          <Bot className="h-4 w-4" /> Contact support
        </Link>
      </section>
    </ExperienceShell>
  );
}
