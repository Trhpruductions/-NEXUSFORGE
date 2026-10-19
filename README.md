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

Requirements: Node 22 or 24 (CI uses 24), PostgreSQL 15+ (a database named `nexusforge`).

```bash
npm install
cp apps/server/.env.example apps/server/.env      # set DATABASE_URL and the JWT secrets
cp apps/web/.env.example apps/web/.env.local       # do NOT set NEXT_PUBLIC_API_URL
cd apps/server && npx prisma db push && npx prisma generate && cd ../..
npm run dev
```

Open http://127.0.0.1:3301 (use `127.0.0.1`, not `localhost`, so the CSRF cookie matches the API origin). The dev website talks to the dev API on 127.0.0.1:4002; in production the website reaches the API through its own origin. Never put `NEXT_PUBLIC_API_URL` in an env file: it gets baked into the build and breaks sign-in over the public address (`npm run dev` sets it for development only).

### Development never touches the live site

The live website and API run on the same PC as this repo (see below). Development uses its own ports, and nothing started by `npm run dev` can stop the live services:

| | Development (`npm run dev`) | Live (pm2) |
| --- | --- | --- |
| Website | http://127.0.0.1:3301 | 127.0.0.1:3300 |
| API | http://127.0.0.1:4002 | 127.0.0.1:4001 |

- `npm run dev` (also `preview:live`, `desktop:full`) first runs `npm run dev:cleanup`, which only stops stale **node** dev servers on 3301 and 4002. It refuses the live ports (3000, 3300, 3400, 4001, 5433) and never stops a process that pm2 manages.
- `scripts/dev-server.mjs` starts each dev server. It refuses the live ports, and if a dev port is already taken it stops with a message instead of killing anything. Other ports: set `NF_DEV_WEB_PORT` / `NF_DEV_API_PORT`.
- The dev API runs with a database pool of 4 (`DB_POOL_MAX`), with the Discord bot, Discord reports and the daily pulse off (`NF_DEV_ALLOW_DISCORD=true` turns them on) and with email in test mode (`NF_DEV_ALLOW_EMAIL=true` sends real mail).
- **On the production PC**, `apps/server/.env` and `apps/web/.env.local` are the live configuration: do not copy the examples over them. The dev API refuses to start on the live database; set `DATABASE_URL` to a test database (for example `nexusforge_test`) in your terminal first.
- `npm run dev:desktop` opens the Electron shell on http://127.0.0.1:3301/app (`NEXUSFORGE_DESKTOP_URL` overrides it). Do not point the desktop app at port 3300 on the production PC.
- Do not run a plain `next build` as a check in `apps/web` on the production PC: `.next-build` is the folder the live site serves. Use `NF_BUILD_DIR=.next-buildcheck` for check builds.

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

Disabled on purpose (they exit with a message): `npm run pm2:workspace:save`, `scripts/pm2-workspace-persist.ps1` and `scripts/startup-production.ps1` (they run `pm2 save`), the scheduled-task installers that ran `startup-production.ps1` as SYSTEM (`setup-tasks-direct.ps1`, `setup-production-automation.bat`, `register-startup-task.ps1`/`.bat`; `-Uninstall` still removes an old task), and the retired ops watchdog scripts that delete and rebuild the live pm2 apps (`ops-managed-watchdog.ps1`, `ops-managed-heal.ps1`, `ops-managed-validate.ps1`). For a read-only health check use `npm run pm2:workspace:doctor` or `node scripts/vexora-watchdog.mjs --once`.

Releases: a new desktop version is published only after the owner approves that exact version. Every script that can publish installers, push gh-pages or change the live update manifest refuses to run without `-OwnerApproved` (`desktop-release-share.ps1`, `publish-desktop-release-gh-pages.ps1`, `deploy-desktop-web-release.ps1`, `desktop-release-deploy-from-env.ps1`, `setup-github-releases.ps1`). The Discord download post after a merge waits for the `release-approval` environment; see [docs/RELEASE-APPROVAL.md](docs/RELEASE-APPROVAL.md).

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
| `npm run dev` | Dev website (3301) + dev API (4002) with hot reload; never touches the live site |
| `npm test -w @nexusforge/server` | API unit tests |
| `npm test -w web` | Website unit tests |
| `npm test -w @nexusforge/desktop` | Desktop unit tests |
| `npm run dev:desktop` | Electron shell against the dev website (http://127.0.0.1:3301/app) |
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
