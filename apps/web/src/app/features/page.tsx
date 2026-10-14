import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Check, KeyRound, Layers, MessagesSquare, Mic2, Monitor, ShieldCheck, Sparkles } from "lucide-react";
import { ExperienceShell } from "@/components/layout/experience-shell";

export const metadata: Metadata = {
  title: "Features",
  description: "Everything in Nexus Forge Gaming: servers, chat, voice and video, moderation, safety, bots, rewards and the desktop app.",
};

/** Only things that exist in the app today. */
const sections = [
  {
    id: "servers",
    icon: Layers,
    title: "Servers that set themselves up",
    lead: "Start a community from a template and have channels, roles and an invite link ready before your first message.",
    items: [
      ["Templates", "Gaming, esports and creator templates, or start empty."],
      ["Channels", "Text, voice, stage, announcement and forum channels, grouped in categories. Private channels for staff or VIPs."],
      ["Roles and permissions", "Ranked roles with per-permission control, nickname overrides and role mentions."],
      ["Invites", "A permanent link you can customise (like nfgcord.com/invite/my-clan), plus expiring or limited-use links."],
      ["Events", "Schedule events for your server with RSVPs and reminders."],
      ["Ownership transfer", "Hand a server to someone else when you move on."],
    ],
  },
  {
    id: "chat",
    icon: MessagesSquare,
    title: "Chat with everything",
    lead: "Fast, rich text chat with the tools people expect.",
    items: [
      ["Threads and forums", "Keep side-conversations out of the main channel; forum channels with tags for guides and LFG."],
      ["Polls, pins and replies", "Quick polls, pinned messages, replies, reactions and Markdown."],
      ["Custom emoji, stickers and GIFs", "Upload your own emoji and stickers per server."],
      ["Mentions that work", "@people, @roles, @everyone and @here, with autocomplete."],
      ["Search with filters", "from:, in:, has:, mentions:, before:, after: and pinned: to find anything."],
      ["Saved messages and notes", "Bookmark messages and keep private notes on people, visible only to you."],
      ["Link previews", "Safe previews for links, fetched by the server so the sender can't track you."],
      ["Mark as read", "One click for a server or for every server."],
    ],
  },
  {
    id: "voice",
    icon: Mic2,
    title: "Voice, video and stages",
    lead: "Low-latency voice channels with camera and screen share, and stage channels for bigger moments.",
    items: [
      ["Voice channels", "Push-to-talk or voice activity, noise suppression, per-person volume, and a soundboard."],
      ["Camera and screen share together", "HD video for everyone; ultra quality (1440p60) on Plus and above."],
      ["Stage channels", "Speakers and an audience, with raise-hand requests."],
      ["Video calls in DMs", "Call a friend without a server."],
      ["Go-live status", "Show on your profile when you're streaming, with a link to the stream."],
    ],
  },
  {
    id: "moderation",
    icon: ShieldCheck,
    title: "Moderation that holds the line",
    lead: "Tools for the moderators who keep a community healthy, with a record of everything.",
    items: [
      ["AutoMod", "Block words (with wildcards and look-alike spellings), links, other servers' invites and mention spam. Alert moderators or time people out automatically."],
      ["Timeouts, kicks and bans", "Bans that stop rejoins, timeouts with a set length, and slowmode per channel."],
      ["Reports queue", "Members report messages and people; moderators review them in one place."],
      ["Audit log", "Who changed what, and when, across the whole server."],
      ["Webhooks", "Post from other tools into a channel with a webhook URL."],
    ],
  },
  {
    id: "safety",
    icon: KeyRound,
    title: "Built-in safety",
    lead: "Your account stays yours.",
    items: [
      ["Two-factor sign-in", "Authenticator app with recovery codes, or codes by email and text."],
      ["Verified email and phone", "Sign in with either; reset your password by email link or text code."],
      ["Change alerts", "An email when your email or phone changes, or a new device signs in."],
      ["Blocking and reporting", "Block anyone, report people and messages, and mute servers you don't want to hear from."],
      ["Adults only", "Nexus Forge is 18+, with optional ID verification for the communities that need it."],
      ["Your data", "Download everything you've posted, or delete your account, from Settings."],
    ],
  },
  {
    id: "bots",
    icon: Bot,
    title: "Bots and integrations",
    lead: "Automate your server, or build on top of Nexus Forge.",
    items: [
      ["Bots in one click", "Browse public bots and add one to your server; set up the /commands people can run."],
      ["Sign in with Nexus Forge", "Let people sign in to your own app or site with their Nexus Forge account (OAuth)."],
      ["Developer webhooks", "Get notified when your bot is installed or a command runs."],
      ["Developer portal", "Register apps, rotate secrets and manage everything in one place."],
    ],
  },
  {
    id: "rewards",
    icon: Sparkles,
    title: "Profiles, rewards and style",
    lead: "Make it yours.",
    items: [
      ["Profiles", "Banner, animated avatar, bio, clan tag, badges and medals, all on the Free plan."],
      ["Avatar studio and wardrobe", "Build an avatar and save outfits."],
      ["Coins and rewards", "Earn coins, run mining rigs, enter jackpots and spend in the store."],
      ["Leaderboards", "Reputation, streaks and medals across the whole network."],
      ["Feed", "Posts and comments for your communities, in one feed."],
    ],
  },
  {
    id: "apps",
    icon: Monitor,
    title: "Everywhere you play",
    lead: "Same account, same servers, whatever you're on.",
    items: [
      ["Browser", "Works in any modern browser at nfgcord.com."],
      ["Windows app", "Its own window, taskbar icon and automatic updates."],
      ["Xbox, phones and tablets", "Install it from the browser: Pin to Home on Xbox, Add to Home Screen on phones."],
      ["Push notifications", "Mentions and DMs reach you when the tab is closed."],
      ["What's new", "Release notes pop up in the app whenever something ships."],
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <ExperienceShell
      eyebrow="Features"
      title="Everything your community needs, in one app"
      subtitle="Servers, chat, voice and video, moderation, safety, bots and rewards. Here's what's inside, all of it on the Free plan unless it says otherwise."
      actions={[
        { label: "Create free account", href: "/register", tone: "primary" },
        { label: "See pricing", href: "/pricing", tone: "ghost" },
      ]}
    >
      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-amber-400/50 hover:text-white">
            {section.title}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 grid gap-6 rounded-2xl border border-amber-500/15 bg-[#0d1119] p-5 md:grid-cols-[0.8fr_1.2fr] md:p-7">
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(46,164,255,0.35),rgba(11,111,224,0.35))] text-white">
                <section.icon className="h-5 w-5" />
              </span>
              <h2 className="nf-heading mt-4 text-2xl font-bold text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.lead}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {section.items.map(([name, text]) => (
                <li key={name} className="rounded-xl border border-white/5 bg-[#11151e] p-4">
                  <p className="flex items-start gap-2 text-sm font-semibold text-white"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> {name}</p>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-slate-400">{text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-amber-400/25 bg-[linear-gradient(135deg,rgba(46,164,255,0.16),rgba(30,139,255,0.2)_55%,rgba(10,86,176,0.16))] p-6 text-center sm:p-10">
        <h2 className="nf-heading text-2xl font-bold text-white sm:text-3xl">Free gets you all of this.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-200">50 MB uploads, 4,000-character messages, HD video, banners and animated avatars are included. Core+ (from $3.99 a month) raises the limits for people who want more.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:-translate-y-px">
            Create account <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10">
            Compare plans
          </Link>
        </div>
      </section>
    </ExperienceShell>
  );
}
