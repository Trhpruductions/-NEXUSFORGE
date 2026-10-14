# Nexus Forge Gaming

Built for gamers. Connected by community.

Nexus Forge Gaming is a Discord-style platform for gaming communities: servers ("forges") with text and voice channels, direct messages, video calls, events and tournaments, creator streams, an avatar studio and wardrobe, achievements, bots with slash commands, and an in-app economy. Live at **https://nfgcord.com**, made by TRH Development.

## Monorepo

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 app (React 19, Tailwind 4, TanStack Query, zustand, socket.io-client) |
| `apps/server` | Express 5 API + Socket.IO gateway, Prisma 7 on PostgreSQL |
| `apps/desktop` | Electron shell that wraps the web app (Windows installer) |
| `packages/*` | Shared config and types |
| `scripts/` | Operations: gateway, Cloudflare tunnel, watchdog, backups, Stripe setup, brand images |
| `docs/` | Drafts and archived notes (legal drafts under `docs/legal`) |

## Run it locally

Requirements: Node 20+, PostgreSQL 15+ (a database named `nexusforge`).

```bash
npm install
cp apps/server/.env.example apps/server/.env      # set DATABASE_URL and the JWT secrets
cp apps/web/.env.example apps/web/.env.local       # NEXT_PUBLIC_APP_URL only; do NOT set NEXT_PUBLIC_API_URL
cd apps/server && npx prisma db push && npx prisma generate && cd ../..
npm run dev
```

Open http://127.0.0.1:3300 (use `127.0.0.1`, not `localhost`, so the CSRF cookie matches the API origin). The web app talks to the API on 127.0.0.1:4001 in development and through its own origin in production; a hard-coded `NEXT_PUBLIC_API_URL` gets baked into the build and breaks sign-in over the public address.

## How the live site runs

One Windows PC hosts everything under pm2 (see `ecosystem.config.cjs`):

| pm2 app | Role |
| --- | --- |
| `nexusforge-backend-workspace` | API on 127.0.0.1:4001 |
| `nexusforge-web-workspace` | Next.js on 127.0.0.1:3300 |
| `vexora-gateway` | One local entrance on 127.0.0.1:3400: `/api`, `/socket.io`, `/uploads` go to the API, the rest to the web app |
| `vexora-tunnel` | Named Cloudflare tunnel that publishes the gateway as https://nfgcord.com |
| `vexora-watchdog` | Checks DB, API, web, gateway and the public site every minute, restarts a stuck piece and posts to Discord |

Deploy a change: `npm run build -w @nexusforge/server` and/or `npm run build -w web`, then `pm2 restart <app> --update-env`. Never run `pm2 save` on this machine (the dump is shared with other bots); `scripts/vexora-autostart.cmd` brings everything back at logon. Daily backups run from `scripts/run-daily-backup.cmd`.

## What works without any third-party keys

- Accounts with email and phone verification codes, two-factor sign-in, session management. In development the codes are printed by the API and shown in the UI.
- Age verification: date-of-birth attestation on every account, government-ID upload with an admin review queue at `/admin/age-verification`.
- Forges with channels, roles and permissions, invites, bans, pinned messages, reactions, replies, mentions, attachments, unread and mention counts, bots with `/commands`.
- Voice channels: built-in peer-to-peer WebRTC voice with mute, deafen, speaking indicators and screen sharing. Calls persist while you browse the app. Add LiveKit keys to switch to a media server.
- Direct messages and friends, with realtime delivery, presence and typing.
- Events and tournaments with RSVPs, brackets, live match reporting and 15-minute reminders.
- Live streams: go live, followers get alerts, viewers watch Twitch / Kick / YouTube embeds in-app, viewer counts and stream history are recorded.
- Avatar Studio (layered SVG avatar with presets and emotes), Wardrobe with vector item art, outfit presets and a coin store.
- Achievements earned from real activity, profile badges, posts and clips with inline players.
- Settings: account, privacy, notifications, appearance (accent, density, text size), voice devices, connections, integrations, roles, moderation, billing.
- Public site: features, pricing, download (Windows installer, phone/Xbox install), developer portal, help center with status card, report-a-problem form, legal center.

## Optional integrations

Set these in `apps/server/.env` to turn on the real thing (the app keeps working without them):

| Feature | Variables |
| --- | --- |
| Email codes | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` |
| SMS codes | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Media-server voice | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` |
| Web push | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` |
| Uploads to object storage | `S3_*` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (`npm run stripe:setup` creates the products) |
| Discord ops bot | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DISCORD_REPORT_*` |

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web + API with hot reload |
| `npm test -w @nexusforge/server` | API unit tests |
| `npm run dev:desktop` | Electron shell against the local web app |
| `npm run desktop:installer` | Build the Windows installer |
| `node scripts/vexora-watchdog.mjs --once` | Run the five health checks by hand |
| `node scripts/grant-lifetime.mjs <username> [tier\|--revoke]` | Lifetime membership |
| `node scripts/brand-images.cjs build` | Regenerate logos and icons from `brand-inbox/` |
| `cd apps/server && npx tsc --noEmit` | Type-check the API |
| `cd apps/web && npx tsc --noEmit && npx eslint src` | Type-check and lint the web app |

## Repository notes

- `var/` holds runtime files (uploads, logs) and is git-ignored.
- After changing `apps/server/prisma/schema.prisma`, run `npx prisma db push && npx prisma generate` and restart the API.
- The many `*_SUMMARY.md` / `*_CHECKLIST.md` files at the root are historical planning documents from earlier phases. `BETA_TESTING.md` is the current beta runbook.
