"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, CreditCard, KeyRound, Layers, MessagesSquare, Mic2, Monitor, Search, ShieldAlert, UserRound, Database } from "lucide-react";

type Article = { q: string; a: string; links?: Array<[string, string]> };
type Topic = { id: string; title: string; icon: typeof BookOpen; articles: Article[] };

/** Help articles. Every step describes something the app does today. */
const topics: Topic[] = [
  {
    id: "start",
    title: "Getting started",
    icon: BookOpen,
    articles: [
      { q: "How do I create an account?", a: "Go to Join free, enter a username, email, password and your date of birth, and accept the Terms and Privacy Policy. You must be 18 or older. We email you a 6-digit code to verify your email; you can enter it straight away or later from Settings → Account protection.", links: [["Create account", "/register"]] },
      { q: "How do I create a server?", a: "In the app, open Community and press New forge. Pick a template (gaming, esports or creator) or start empty. Your server comes with channels, roles and a permanent invite link you can share right away.", links: [["Open Community", "/app/server"]] },
      { q: "How do I join someone's server?", a: "Open their invite link (nfgcord.com/invite/…) and press Join, or paste the invite code into Community → Join with invite." },
      { q: "Do I need to download anything?", a: "No. Nexus Forge works in your browser. If you prefer a separate window with automatic updates, there's a free Windows app on the Download page. On Xbox and phones you can install it from the browser.", links: [["Download", "/download"]] },
    ],
  },
  {
    id: "account",
    title: "Account and sign-in",
    icon: UserRound,
    articles: [
      { q: "I forgot my password", a: "Go to Forgot password and enter your account email: we send a reset link that works for 30 minutes. If you've verified a phone number and texts are switched on, you can get a 6-digit code by text instead. Resetting your password signs you out on every device.", links: [["Forgot password", "/forgot-password"]] },
      { q: "Can I sign in with my phone number?", a: "Yes, once the number is verified in Settings → Account protection. Enter it in the Email or phone number box with your password." },
      { q: "How do I change my username?", a: "Settings → Account → Username, then press Change. Usernames are 3 to 32 letters, numbers or underscores, and you can change yours once a day." },
      { q: "How do I change my email?", a: "Settings → Account → Email. You'll be asked for your current password, and for a confirmation code if two-factor is on. The old address gets an email about the change, and the new one needs verifying." },
      { q: "Someone got into my account. What do I do?", a: "Reset your password right away from Forgot password (that signs out every device), then turn on two-factor in Settings → Account protection and check your email and phone are still yours. If you can't get back in, send a problem report with your username and we'll help.", links: [["Forgot password", "/forgot-password"], ["Report a problem", "#report"]] },
      { q: "How do I delete my account or download my data?", a: "Both are in Settings. Download your data gives you everything you've posted as a file. Deleting your account removes it after a short grace period; sign in during that time and choose Keep my account to cancel." },
    ],
  },
  {
    id: "security",
    title: "Verification and two-factor",
    icon: KeyRound,
    articles: [
      { q: "How do I verify my email or phone?", a: "Settings → Account protection. Press Send code (email) or enter your number and press Text me a code (you'll be asked for your password). Enter the 6-digit code you receive. Codes last 10 minutes and you get 5 tries." },
      { q: "How do I turn on two-factor sign-in?", a: "Settings → Account protection → Turn on two-factor. With a verified email, sign-ins will need a code sent to your email (and phone, if verified). For the strongest option, set up an authenticator app: scan the QR code, enter the app's code, and save the recovery codes somewhere safe." },
      { q: "I lost my authenticator app", a: "Sign in with one of the recovery codes you saved when you set it up (each works once). Then turn the authenticator off and on again in Settings to get a fresh set. If you have no recovery codes, send a problem report from the email on the account." },
      { q: "Why do I keep getting 'please wait' when requesting a code?", a: "You can request a new code every 45 seconds. Check your spam folder first; the previous code is still valid for 10 minutes." },
      { q: "What is ID verification?", a: "Some communities require members to prove they're adults. In Settings → Age verification you confirm your date of birth and can upload a government ID (and optional selfie) for staff review. Only staff reviewers can see the documents, and you can delete a pending submission at any time." },
    ],
  },
  {
    id: "servers",
    title: "Servers, roles and moderation",
    icon: Layers,
    articles: [
      { q: "Where are the server settings?", a: "In chat, press the gear icon in the channel header (or the settings button next to a server in Community). Tabs: Overview, Channels, Roles, Members, Invites, Reports, AutoMod, Emoji, Stickers, Soundboard, Webhooks, Bots, Bans, Audit log." },
      { q: "How do I give someone moderator powers?", a: "Server settings → Roles. Create a role, tick the permissions it should have (moderate chat, manage channels, kick, ban…), then add the person to it under Members. Higher roles can manage lower ones." },
      { q: "How do I stop spam automatically?", a: "Server settings → AutoMod. Add rules for blocked words (wildcards like scam* work), links, other servers' invites and mention spam. Each rule can delete the message, alert moderators or time the person out." },
      { q: "How do invites work?", a: "Server settings → Invites. Your permanent link never expires; owners can customise it (for example nfgcord.com/invite/my-clan). You can also create links that expire after a time or a number of uses, and revoke any of them." },
      { q: "How do I add a bot?", a: "Server owners: Server settings → Bots. Search the public bots and press Add, or paste a bot's invite code. Then add /commands: the bot's reply can include {user}, {forge}, {channel} and {args}. Members run a command by typing / in any channel." },
      { q: "How do I mark everything as read?", a: "Open the server menu at the top of the sidebar and choose Mark … as read or Mark all servers as read. You can also right-click a server icon." },
      { q: "How do I transfer or delete a server?", a: "Server settings → the last tab (Delete). Owners can transfer ownership to another member or delete the server. Members use the same tab to leave." },
    ],
  },
  {
    id: "chat",
    title: "Chat",
    icon: MessagesSquare,
    articles: [
      { q: "What are the limits on uploads and messages?", a: "Free: files up to 50 MB and messages up to 4,000 characters. Core+ plans raise the upload limit. During the beta, single uploads are capped at 95 MB on every paid plan while large-file storage is being set up. When something is over your limit, the app tells you which plan would allow it." },
      { q: "How do I search?", a: "Use the search box in chat. Narrow it with from:name, in:channel, has:link (or image, file, poll), mentions:name, before:, after:, during: and pinned:true." },
      { q: "How do threads and forums work?", a: "Reply in a thread from any message to keep a side-conversation out of the channel. Forum channels show each post as its own topic with tags; create them in Server settings → Channels." },
      { q: "Can I save a message for later?", a: "Yes: use Save on any message. Your saved messages are in the app sidebar, and nobody else can see them. You can also keep a private note on any person from their profile." },
    ],
  },
  {
    id: "voice",
    title: "Voice, video and stages",
    icon: Mic2,
    articles: [
      { q: "Nobody can hear me", a: "Check the microphone and input device in Settings → Voice, and that your browser allowed microphone access (the lock icon next to the address). If you use push-to-talk, hold the key you set. The desktop app and the browser each ask for permission separately." },
      { q: "How do I share my screen or camera?", a: "Join a voice channel and use the camera and screen buttons at the bottom. Both can be on at once. Free includes a 720p camera and 1080p30 screen share. Ultra quality (1440p60 screen share, 1080p camera) is on Plus and above, once paid plans open." },
      { q: "What is a stage channel?", a: "A channel where a few people speak and everyone else listens. Moderators invite speakers; listeners can raise a hand to ask for the mic. Create one in Server settings → Channels." },
      { q: "Calls keep dropping or won't connect", a: "This is usually a strict network (school, work or mobile data) blocking peer-to-peer media. Try a different network or the desktop app. If it keeps happening, send a problem report with where you were connecting from." },
    ],
  },
  {
    id: "billing",
    title: "Core+ and payments",
    icon: CreditCard,
    articles: [
      { q: "What do I get with Core+?", a: "Bigger uploads, more servers you can join and, from Plus up, ultra-quality video. Everything else, including HD video, banners and animated avatars, is already free. The Pricing page shows exactly what each plan unlocks.", links: [["Pricing", "/pricing"]] },
      { q: "How do I pay, and how do I cancel?", a: "Payments go through Stripe by card; you're sent to Stripe's secure checkout and back. Manage or cancel any time from Settings → Billing → Manage subscription, which opens Stripe's billing portal. Your plan stays active until the end of the period you paid for." },
      { q: "I paid but my plan didn't switch on", a: "Give it a minute and refresh the Core+ page. If it still shows Free, send a problem report with the email you used at checkout and we'll put it right." },
    ],
  },
  {
    id: "apps",
    title: "Desktop app, Xbox and phones",
    icon: Monitor,
    articles: [
      { q: "How do I install the Windows app?", a: "Download it from the Download page and run the installer. Windows may show a blue 'Windows protected your PC' screen because the app isn't code-signed yet: choose More info → Run anyway. The app updates itself.", links: [["Download", "/download"]] },
      { q: "Can I use Nexus Forge on Xbox?", a: "Yes, through the console's browser: open Microsoft Edge on the Xbox, go to nfgcord.com and sign in. Press the Menu button and choose Pin to Home so it opens like an app. A keyboard makes typing much faster." },
      { q: "Is there a phone app?", a: "Open nfgcord.com in your phone's browser and install it: on Android and Edge/Chrome choose Install app from the menu; on iPhone and iPad use Share → Add to Home Screen. It then opens full-screen like an app." },
      { q: "The desktop app says it can't reach the server", a: "Check that nfgcord.com opens in your browser. If it does, close the app completely and reopen it; its recovery screen also lets you retry. If the website is down too, see the status card above." },
    ],
  },
  {
    id: "safety",
    title: "Safety and reporting",
    icon: ShieldAlert,
    articles: [
      { q: "How do I block someone?", a: "Open their profile and choose Block. They can't message you or see your activity, and you won't see theirs. You don't need to be friends first." },
      { q: "How do I report a message or a person?", a: "On a message, open the menu and choose Report. On a profile, choose Report. Reports go to the server's moderators and, for serious issues, to Nexus Forge staff. You can also use the Report a problem form below if you can't sign in." },
      { q: "What is Nexus Forge's age policy?", a: "Nexus Forge Gaming is for adults only. You must be 18 or older to create an account, and accounts registered to someone under 18 are refused at sign-in." },
      { q: "How do I mute a noisy server?", a: "Open the server menu at the top of the sidebar → Notification settings. Mute it for a while or for good, or get only @mentions. Muted servers show no unread dot." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    icon: Database,
    articles: [
      { q: "Who can see my email and phone?", a: "Nobody but you and, when needed, support staff. Other members see your username, display name, avatar and public profile. Your email and phone are never shown in the app or the API." },
      { q: "Where are the policies?", a: "The Legal Center has the Terms of Service, Privacy Policy and every other policy, each with its version and effective date.", links: [["Legal Center", "/legal"]] },
    ],
  },
];

function matches(article: Article, topic: Topic, query: string) {
  const haystack = `${topic.title} ${article.q} ${article.a}`.toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/** Searchable help articles, grouped by topic. */
export function HelpCenter() {
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      topics
        .filter((topic) => !topicId || topic.id === topicId)
        .map((topic) => ({ ...topic, articles: topic.articles.filter((article) => !q || matches(article, topic, q)) }))
        .filter((topic) => topic.articles.length),
    [q, topicId],
  );
  const total = visible.reduce((sum, topic) => sum + topic.articles.length, 0);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help, e.g. two-factor, invite link, screen share"
          aria-label="Search help articles"
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0d1119] pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Topics">
        <button type="button" role="tab" aria-selected={topicId === null} onClick={() => setTopicId(null)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${topicId === null ? "bg-amber-400 text-slate-950" : "border border-white/10 text-slate-300 hover:border-white/25"}`}>
          All topics
        </button>
        {topics.map((topic) => (
          <button key={topic.id} type="button" role="tab" aria-selected={topicId === topic.id} onClick={() => setTopicId(topicId === topic.id ? null : topic.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${topicId === topic.id ? "bg-amber-400 text-slate-950" : "border border-white/10 text-slate-300 hover:border-white/25"}`}>
            <topic.icon className="h-3.5 w-3.5" /> {topic.title}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-6 text-sm text-slate-300">
          <p className="font-semibold text-white">No articles match &ldquo;{query}&rdquo;.</p>
          <p className="mt-1 text-slate-400">Try different words, or <a href="#report" className="font-semibold text-amber-200 hover:text-white">tell us what&apos;s wrong</a> and we&apos;ll help directly.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((topic) => (
            <section key={topic.id} id={`help-${topic.id}`} className="scroll-mt-24 rounded-2xl border border-amber-500/15 bg-[#0d1119] p-5">
              <h2 className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white">
                <topic.icon className="h-4 w-4 text-amber-300" /> {topic.title}
              </h2>
              <div className="mt-3 divide-y divide-white/5">
                {topic.articles.map((article) => (
                  <details key={article.q} open={Boolean(q)} className="group py-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-slate-100 hover:text-white">
                      {article.q}
                      <span className="shrink-0 text-lg leading-none text-amber-300 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{article.a}</p>
                    {article.links?.length ? (
                      <p className="mt-2 flex flex-wrap gap-3 text-xs">
                        {article.links.map(([label, href]) =>
                          href.startsWith("#") ? (
                            <a key={href} href={href} className="font-semibold text-amber-200 hover:text-white">{label} →</a>
                          ) : (
                            <Link key={href} href={href} className="font-semibold text-amber-200 hover:text-white">{label} →</Link>
                          ),
                        )}
                      </p>
                    ) : null}
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
