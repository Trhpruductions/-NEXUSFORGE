# Vexora Gaming: full app status report

**Date:** 2026-10-12. **Branch:** `feat/community-feed` (not pushed).

This report is based on four audits run in parallel (server, web pages, config and integrations, quality and performance). Every item marked **Fixed** was checked against the running app.

---

## 1. What's built and working

These features are tested end to end with real accounts, and most also with two real browsers:

| Area | What works |
|---|---|
| Accounts | Sign-up (18+), sign-in, email/SMS codes, authenticator-app 2FA with recovery codes, active sessions, new-device alerts, password reset (now emailed), data export, 14-day account deletion |
| Servers ("forges") | Create/join/leave, invites (expiring and limited), categories, private channels, roles and permissions with rank checks, ownership transfer, audit log, kick/ban/timeout, slowmode, AutoMod, custom emoji, stickers, soundboard, webhooks, per-server notification settings |
| Chat | Text and announcement channels, forums with tags, threads, replies, reactions, pins, edits/deletes, mentions (@user, @role, @everyone/@here), Markdown, link previews (SSRF-safe), file uploads, polls, stickers, search with filters, unread and mention badges, saved messages, reports |
| DMs | 1:1 and group DMs, edit/delete, reports, saved messages |
| Voice and video | Voice channels (up to 10, peer to peer), camera and screen share, push-to-talk, stage channels (speakers, audience, raise hand), soundboard |
| Social | Friends, blocking, follows, private notes on people, feed with posts and comments, profiles, avatars, events with brackets |
| Safety | Message reports to server moderators or to staff, staff report queue, platform account suspensions with appeals history, Legal Center with versioned policies and consent |
| Extras | Coins, transfers, jackpot (provably fair), mining, store, cosmetics, leaderboards, developer portal (bots, OAuth apps, webhooks) |

**Tests:**
- Server unit tests: 123 of 123.
- 20 end-to-end suites: about 450 checks, all passing.
- Browser tests: video call, stage, polls, stickers/soundboard, saved messages/notes.

---

## 2. Fixed in this round (security)

| Problem | Risk | Status |
|---|---|---|
| Password reset returned the reset token in the API response | Anyone who knew your email could take over your account | **Fixed**: link is emailed; the same answer is given for unknown emails |
| Profile activity and 3 admin endpoints returned full user rows (password hash, 2FA secrets) | Credential leak | **Fixed** |
| OAuth `/authorize` had no consent screen and returned full sessions | Any registered app could take over any visitor | **Fixed for now**: an app can only sign in its own developer. A consent screen is still to build |
| CORS allowed any `https://` site when only local origins were set | Any website could read signed-in API responses | **Fixed** |
| Developer webhooks could target this PC or the LAN (SSRF) | Internal network access | **Fixed** |
| User search matched email addresses | Revealed who has an account | **Fixed** |
| Age-gate secret was a placeholder committed to git | Forged "18+" passes | **Fixed**: real secret in `apps/web/.env.local` |
| Desktop app turned off TLS certificate checks by default | Network impersonation | **Fixed**: the change applies from the next desktop build |
| Stripe webhook could fail permanently on retry | Paid purchases never applied | **Fixed** |
| Database connection drop crashed the server | Outages | **Fixed** (earlier round) |
| Unread counts ran one query per channel on every page load | Slow with many servers | **Fixed** |
| Missing database indexes on common lookups | Slow member/friend/DM queries | **Fixed** |

---

## 3. Still open: needs you (I can't do these without your accounts or decisions)

| Item | Why it matters | What I need |
|---|---|---|
| **Billing (Stripe)** | Pricing and checkout are built but switched off | See section 6: your Stripe keys and price IDs |
| **TURN server** | Voice/video fails for people behind strict networks | Pick Cloudflare, Metered or self-hosted coturn |
| **GIF picker** | Not built | A Tenor or Giphy API key |
| **Discord bot** | Won't start (client ID mismatch) | The correct `DISCORD_CLIENT_ID` |
| **Legal documents** | Drafts can't be published until the placeholders are filled | Operator name, contact emails, jurisdiction, launch date and similar, filled in at `/admin/legal` |
| **Public hosting** | The app only runs on this PC (127.0.0.1) | A domain with HTTPS (Cloudflare Tunnel or a server), then set `CLIENT_ORIGIN`, `APP_WEB_URL` and `NEXT_PUBLIC_API_URL` |
| **SMS** | SMS codes don't send | Twilio account, or I turn SMS off |
| **PR #4 / pushing the branch** | Work isn't on GitHub yet | Your go-ahead |
| **Duplicate Owner account** "trhdevelpment" | Extra all-powerful account | Demote it or keep it? |

---

## 4. Still open: I can build these next (no input needed)

**High priority (security and correctness)**
1. **OAuth consent screen**: a proper "Allow this app?" page, so third-party apps can sign in other users safely.
2. **Discord bot account linking**: the bot currently matches Discord users to Vexora accounts by username, which can be spoofed. Needs a verified link, and the "harvest all" button must check who clicked it.
3. **Mining and crypto coin races**: harvest, decommission and swap aren't atomic, so double-spending or losing coins is possible under concurrent requests.
4. **Cosmetics purchase**: coins can be charged without the item being granted if the second step fails.
5. **Socket hardening**: rate limits on typing, voice signalling and joins; payload size limits; catching a few unhandled database errors.
6. **Voice state**: `POST /voice/state` lets a member send fake mute/deafen state into rooms they're not in.
7. **Live stream URL**: accepts `javascript:` links.
8. **Refresh-token reuse detection**: if a stolen refresh token is used, the whole session should be revoked.
9. **The MODERATOR app role** grants no staff access anywhere.

**Data and operations**

10. **Cleanup job** for tables that grow forever:
    - expired codes and tokens
    - old notifications
    - audit logs (the admin audit router exists but isn't mounted)
11. **Stale "LIVE" creators**: creators stay marked live forever after disconnecting.
12. **Postgres and uploads backups**: none exist today.
13. **Log rotation** for pm2 logs.
14. **CI**: GitHub Actions never runs typecheck, tests or build. Add it.
15. **Error reporting**: crashes only go to logs and Discord.

**Features and polish**

16. **Push notifications**: the settings toggle saves a preference, but nothing ever subscribes the browser.
17. **DM composer**: no attachments, emoji or stickers (the channel composer has them).
18. **Blocking and reporting**:
    - You can't block someone who isn't your friend.
    - You can't report users, profiles, posts or servers (only messages).
19. **Username change**: the field is disabled.
20. **Settings page**:
    - Duplicated sections.
    - "View audit logs" sends server owners to the staff console.
    - "Manage roles" links don't open the right panel.
21. **Old redirects drop `?q=` and `?filter=`**: `/search`, `/notifications` and `/settings` lose their query strings.
22. **Mobile menu missing on public pages**: landing, pricing and legal pages have no menu on phones.
23. **Accessibility**:
    - 9 popups aren't marked as dialogs.
    - Chat inputs have no labels.
    - The skip link points nowhere.
24. **Fake or placeholder content**:
    - "Advanced Moderation AI" is just row counts.
    - "Priority routing" and "+32% queue gain" are made up.
    - Payment methods are over-claimed (PayPal and crypto aren't supported).
    - Beta-page metrics are made up.
    - "Generate sample data" writes fake data onto real users.
25. **Leftover "NexusForge" branding**: push notification title, desktop installer file name, some environment-variable names shown in the UI.
26. **Dead code**:
    - 17 unused components.
    - `/app/forge-ops`, a 3,400-line duplicate of chat.
    - Unused models (`ProgressiveJackpot`, `ShopItem`).
    - API keys can be created but are never accepted anywhere.
27. **Speed**:
    - LiveKit, the server settings panel and QR code code load on every page.
    - No code splitting.
    - Some very large files: `api.ts` (3,500 lines), `forge-chat-client.tsx`.
28. **Scaling**: the server is single-instance only (in-memory presence, voice and rate limits). Fine for now; it needs Redis to run more than one server.

---

## 5. Suggested order

1. Connect billing (section 6), set up a TURN server, and put the app on a domain with HTTPS.
2. I build: OAuth consent screen, Discord linking fix, coin-race fixes, socket hardening, cleanup job, backups, CI.
3. Then: push notifications, DM composer parity, blocking/reporting, settings cleanup, and mobile menus.
4. Then: remove the fake content and dead code, finish the rebrand, and the speed work.

---

## 6. How to connect billing (Stripe)

The code is ready. Once the keys below are in place, checkout, the customer portal and subscriptions work, and plan limits start being enforced. (Until then, everyone gets at least the Free plan.)

**What each plan includes:** see the pricing page or `apps/server/src/lib/plans.ts`. Free already includes what Discord charges Nitro for (4,000-character messages, banner, animated avatar, HD video, 50 MB uploads, 200 servers). Paid plans add bigger uploads, more servers and ultra 1440p60 video.

1. Create a Stripe account at stripe.com. Use **Test mode** first.
2. In Stripe **Products**, create the plans and copy each **price ID** (starts with `price_`):
   - Core+ tiers (recurring): Core, Plus, Elite and Infinite, each with a **monthly** and a **yearly** price. That's 8 prices.
   - No add-on prices are needed: only Core+ plans are sold. The add-ons did nothing, so they were taken off sale.
3. In **Developers → API keys**, copy the **Secret key** (`sk_test_...`).
4. In **Developers → Webhooks**, add an endpoint at `https://<your public API address>/api/billing/webhook`.
   - Select these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`.
   - Copy the **Signing secret** (`whsec_...`).
   - Stripe can only reach a public address, so this step needs the app online. For local testing, use the Stripe CLI: `stripe listen --forward-to 127.0.0.1:4001/api/billing/webhook`.
5. Put these lines in `apps/server/.env` yourself. Don't paste the keys into chat.
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_CORE_MONTHLY=price_...
   STRIPE_PRICE_CORE_YEARLY=price_...
   STRIPE_PRICE_PLUS_MONTHLY=price_...
   STRIPE_PRICE_PLUS_YEARLY=price_...
   STRIPE_PRICE_ELITE_MONTHLY=price_...
   STRIPE_PRICE_ELITE_YEARLY=price_...
   STRIPE_PRICE_INFINITE_MONTHLY=price_...
   STRIPE_PRICE_INFINITE_YEARLY=price_...
   ```
6. Tell me when it's done. I'll restart the server and run a test checkout with Stripe's test card, without needing to see your keys.
7. Before taking real money:
   - Switch to live keys.
   - Publish the Terms and the Refund Policy (the Refund Policy still needs a draft).
   - Fill in `[Payment Processor]` in the Privacy Policy.
